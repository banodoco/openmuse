
import { useState, useCallback, useEffect, useRef } from 'react';
import { LoraAsset } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVideoManagement } from './useVideoManagement';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';

const logger = new Logger('useLoraManagement');

export const useLoraManagement = () => {
  const [loras, setLoras] = useState<LoraAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { videos, isLoading: videosLoading } = useVideoManagement();
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);
  const fetchInProgress = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const adminCheckAttempted = useRef(false);
  const adminCheckInProgress = useRef(false);

  const checkUserIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      // Fix the query to avoid ambiguous column reference
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        logger.error("Error checking admin role:", error);
        return false;
      }
      
      return !!data;
    } catch (e) {
      logger.error("Error in admin check:", e);
      return false;
    }
  };

  const loadAllLoras = useCallback(async () => {
    if (!isMounted.current || fetchInProgress.current) {
      logger.log("Fetch already in progress or component unmounted, skipping");
      return;
    }
    
    fetchInProgress.current = true;
    setIsLoading(true);
    fetchAttempted.current = true;
    logger.log("Loading all LoRAs");
    
    try {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      loadingTimeoutRef.current = setTimeout(() => {
        if (isMounted.current && isLoading) {
          logger.warn("LoRA loading timeout reached, forcing completion");
          setIsLoading(false);
          fetchInProgress.current = false;
        }
      }, 10000); // 10 second timeout
      
      let query = supabase
        .from('assets')
        .select('*')
        .or(`type.ilike.%lora%,type.eq.LoRA,type.eq.lora,type.eq.Lora`);
        
      let isAdmin = false; 
      if (user) {
        if (!adminCheckAttempted.current && !adminCheckInProgress.current) {
          adminCheckInProgress.current = true;
          try {
            isAdmin = await checkUserIsAdmin(user.id);
            adminCheckAttempted.current = true;
            logger.log(`User ${user.id} is admin: ${isAdmin}`);
          } catch (error) {
            logger.error("Error checking admin role:", error);
            isAdmin = false;
          } finally {
            adminCheckInProgress.current = false;
          }
        }
      }
      
      const { data: loraAssets, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        logger.error("Error querying LoRA assets:", error);
        throw error;
      }
      
      logger.log("LoRA assets from database:", loraAssets?.length || 0);
      if (loraAssets?.length) {
        logger.log("Sample asset data:", loraAssets[0]);
      }
      
      if (!isMounted.current) return;

      // Fetch profiles for all user_ids to get display names
      const userIds = loraAssets
        ?.filter(asset => asset.user_id)
        .map(asset => asset.user_id) || [];
      
      const uniqueUserIds = [...new Set(userIds)].filter(Boolean) as string[];
      
      let userProfiles: Record<string, string> = {};
      
      if (uniqueUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', uniqueUserIds);
        
        if (profilesError) {
          logger.error("Error fetching user profiles:", profilesError);
        } else if (profiles) {
          // Create a map of user_id to display_name or username
          userProfiles = profiles.reduce((acc, profile) => {
            acc[profile.id] = profile.display_name || profile.username || '';
            return acc;
          }, {} as Record<string, string>);
        }
      }
      
      const lorasWithVideos = loraAssets?.map((asset) => {
        const primaryVideo = videos.find(v => v.id === asset.primary_media_id);
        
        const assetVideos = videos.filter(v => 
          v.metadata?.assetId === asset.id ||
          (v.metadata?.loraName && 
           v.metadata.loraName.toLowerCase() === (asset.name || '').toLowerCase())
        );
        
        const admin_approved = asset.admin_approved || 'Listed';
        
        // Add display_name from profiles if available
        const creatorDisplayName = asset.user_id && userProfiles[asset.user_id] 
          ? userProfiles[asset.user_id] 
          : asset.creator;
        
        // We're mapping database columns to our LoraAsset interface, making sure to not reference non-existent columns
        return {
          ...asset,
          primaryVideo,
          videos: assetVideos,
          admin_approved,
          creatorDisplayName
        } as LoraAsset;
      }) || [];
      
      logger.log("Final LoRAs with videos:", lorasWithVideos.length);
      
      if (isMounted.current) {
        setLoras(lorasWithVideos);
        setIsLoading(false);
        
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      }
    } catch (error) {
      logger.error("Loading LoRAs:", error);
      if (isMounted.current) {
        toast.error("Error loading LoRAs. Please try again.");
        setIsLoading(false);
        
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      }
    } finally {
      fetchInProgress.current = false;
    }
  }, [videos, user]);

  useEffect(() => {
    if (!videosLoading && !fetchAttempted.current && !fetchInProgress.current) {
      logger.log("Videos loaded, loading LoRAs");
      loadAllLoras();
    }
  }, [videos, videosLoading, loadAllLoras]);

  useEffect(() => {
    logger.log(`Auth state in useLoraManagement: ${user ? 'signed in' : 'not signed in'}`);
    
    if (user && !isLoading && !fetchInProgress.current) {
      if (!fetchAttempted.current) {
        logger.log("Auth state changed with user, reloading LoRAs");
        loadAllLoras();
      }
    }
  }, [user, loadAllLoras, isLoading]);

  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      logger.log("useLoraManagement unmounting, cleaning up");
      
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []);

  const refetchLoras = useCallback(async () => {
    if (isMounted.current && !fetchInProgress.current) {
      logger.log("Manually refreshing LoRAs");
      fetchAttempted.current = false;
      adminCheckAttempted.current = false;
      await loadAllLoras();
      toast.success("LoRAs refreshed");
    } else {
      logger.log("Skipping manual refresh - fetch already in progress or component unmounted");
    }
  }, [loadAllLoras]);

  return {
    loras,
    isLoading,
    refetchLoras
  };
};
