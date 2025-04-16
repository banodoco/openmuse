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
  const { user, isLoading: isAuthLoading } = useAuth();
  const { videos, isLoading: videosLoading } = useVideoManagement();
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);
  const fetchInProgress = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkUserIsAdmin = async (userId: string): Promise<boolean> => {
    try {
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

  const associateVideosWithLoras = useCallback((loraAssets: LoraAsset[], videoData: VideoEntry[]) => {
    logger.log("Associating videos with LoRAs");
    return loraAssets.map((asset) => {
      const primaryVideo = videoData.find(v => v.id === asset.primary_media_id);
      const assetVideos = videoData.filter(v => 
        v.metadata?.assetId === asset.id ||
        (v.metadata?.loraName && 
         v.metadata.loraName.toLowerCase() === (asset.name || '').toLowerCase())
      );
      
      // Profile data should already be fetched and attached to asset if needed
      const creatorDisplayName = asset.creatorDisplayName || asset.creator;

      return {
        ...asset,
        primaryVideo,
        videos: assetVideos,
        // Keep other existing properties like admin_approved, creatorDisplayName, model_variant
      } as LoraAsset;
    });
  }, []);

  const loadAllLoras = useCallback(async (skipVideoAssociation = false) => {
    if (!isMounted.current || fetchInProgress.current) {
      logger.log("Fetch already in progress or component unmounted, skipping");
      return;
    }
    
    fetchInProgress.current = true;
    setIsLoading(true);
    fetchAttempted.current = true;
    logger.log(`Loading all LoRAs (skipVideoAssociation=${skipVideoAssociation})`);
    
    let fetchedLoraAssets: any[] = []; // Store fetched assets temporarily

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
        .select('*') // Fetch profiles initially? Could optimize later.
        .or(`type.ilike.%lora%,type.eq.LoRA,type.eq.lora,type.eq.Lora`);
        
      const { data: loraAssetsData, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        logger.error("Error querying LoRA assets:", error);
        throw error;
      }
      
      logger.log("LoRA assets from database:", loraAssetsData?.length || 0);
      if (!loraAssetsData) {
         throw new Error("No LoRA assets returned from database");
      }

      fetchedLoraAssets = loraAssetsData;

      // --- Fetch Profiles --- (Keep this part)
      const userIds = fetchedLoraAssets
        .filter(asset => asset.user_id)
        .map(asset => asset.user_id);
      const uniqueUserIds = [...new Set(userIds)].filter(Boolean) as string[];
      let userProfiles: Record<string, string> = {};
      if (uniqueUserIds.length > 0) {
        logger.log("Fetching user profiles for display names:", uniqueUserIds.length);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', uniqueUserIds);
        
        if (profilesError) {
          logger.error("Error fetching user profiles:", profilesError);
        } else if (profiles) {
          logger.log("Fetched user profiles:", profiles.length);
          profiles.forEach(profile => {
            logger.log(`Profile ${profile.id}: display_name=${profile.display_name}, username=${profile.username}`);
          });
          
          userProfiles = profiles.reduce((acc, profile) => {
            acc[profile.id] = profile.display_name || profile.username || '';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // --- Map assets and attach profile data --- (Keep this part)
       const lorasWithProfiles = fetchedLoraAssets.map((asset) => {
          const creatorDisplayName = asset.user_id && userProfiles[asset.user_id] 
            ? userProfiles[asset.user_id] 
            : asset.creator;
          
          logger.log(`Asset ${asset.id} creator info mapping:`, {
            user_id: asset.user_id, creator: asset.creator,
            final_display_name: creatorDisplayName
          });

          return {
            ...asset,
            creatorDisplayName,
             admin_approved: asset.admin_approved || 'Listed',
             model_variant: asset.model_variant
          } as LoraAsset; // Initial mapping without videos
       });

      if (isMounted.current) {
        if (skipVideoAssociation) {
           // Set state with only profile data, videos will be associated later
           logger.log("Setting LoRAs state (without video association yet)");
           setLoras(lorasWithProfiles);
        } else {
           // Associate videos immediately if not skipping
           const finalLoras = associateVideosWithLoras(lorasWithProfiles, videos);
           logger.log("Setting LoRAs state (with video association)");
           setLoras(finalLoras);
        }
        setIsLoading(false); // Set loading false after fetch/initial association
        
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
  }, [associateVideosWithLoras, videos]);

  useEffect(() => {
    logger.log(`Lora effect trigger: videosLoading=${videosLoading}, fetchAttempted=${fetchAttempted.current}, fetchInProgress=${fetchInProgress.current}`);
    
    if (!fetchAttempted.current && !fetchInProgress.current) {
      logger.log("Initial LoRA load triggered (will associate videos later if needed).");
      // Initial load - skip video association for now, it will happen when videos load
      loadAllLoras(true); 
    } else if (!videosLoading && fetchAttempted.current && !fetchInProgress.current && loras.length > 0) {
      // Videos finished loading *after* initial LoRA fetch, and we have LoRAs in state
      // Now, just associate the videos with the existing LoRA data
      logger.log("Videos finished loading after LoRAs, associating videos with existing LoRA state.");
      const updatedLoras = associateVideosWithLoras(loras, videos);
      // Only update state if the video associations actually changed something (optional optimization)
      // This deep comparison could be expensive, maybe skip
      // if (!isEqual(updatedLoras, loras)) { 
           setLoras(updatedLoras); 
      // }
    }
    // Depend on videosLoading state and the videos array itself for re-association
  }, [videosLoading, videos, loadAllLoras, associateVideosWithLoras]);

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
