import { useState, useCallback, useEffect, useRef } from 'react';
import { LoraAsset } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVideoManagement } from './useVideoManagement';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';

const logger = new Logger('useLoraManagement');
logger.log('useLoraManagement hook initializing');

export const useLoraManagement = () => {
  logger.log('useLoraManagement executing');
  const [loras, setLoras] = useState<LoraAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: isAuthLoading } = useAuth();
  const { videos, isLoading: videosLoading } = useVideoManagement();
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);
  const fetchInProgress = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  logger.log(`useLoraManagement: Initial state - isAuthLoading: ${isAuthLoading}, videosLoading: ${videosLoading}`);

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

  const loadAllLoras = useCallback(async () => {
    logger.log('[loadAllLoras] Attempting to load...');
    if (!isMounted.current) {
      logger.log("[loadAllLoras] Skipping: Component unmounted");
      return;
    }
    if (fetchInProgress.current) {
      logger.log("[loadAllLoras] Skipping: Fetch already in progress");
      return;
    }
    if (videosLoading) {
      logger.log("[loadAllLoras] Skipping: Videos still loading");
      return;
    }

    logger.log('[loadAllLoras] Conditions met (mounted, not in progress, videos loaded). Setting fetchInProgress=true, isLoading=true');
    fetchInProgress.current = true;
    setIsLoading(true);
    fetchAttempted.current = true;
    logger.log("[loadAllLoras] Fetching LoRA assets from Supabase...");

    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMounted.current && isLoading) {
        logger.warn("[loadAllLoras] Timeout reached (10s), forcing isLoading=false");
        setIsLoading(false);
        fetchInProgress.current = false;
      }
    }, 10000);

    try {
      let query = supabase
        .from('assets')
        .select('*')
        .or(`type.ilike.%lora%,type.eq.LoRA,type.eq.lora,type.eq.Lora`);
      const { data: loraAssets, error } = await query.order('created_at', { ascending: false });

      if (!isMounted.current) {
        logger.log("[loadAllLoras] Component unmounted during LoRA asset fetch, aborting.");
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        fetchInProgress.current = false;
        return;
      }
      if (error) {
        logger.error("[loadAllLoras] Error querying LoRA assets:", error);
        throw error;
      }
      logger.log("[loadAllLoras] Fetched LoRA assets count:", loraAssets?.length || 0);

      const userIds = loraAssets?.filter(asset => asset.user_id).map(asset => asset.user_id) || [];
      const uniqueUserIds = [...new Set(userIds)].filter(Boolean) as string[];
      let userProfiles: Record<string, string> = {};

      if (uniqueUserIds.length > 0) {
        logger.log("[loadAllLoras] Fetching profiles for user IDs:", uniqueUserIds);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', uniqueUserIds);

        if (!isMounted.current) {
          logger.log("[loadAllLoras] Component unmounted during profile fetch, aborting.");
          if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
          fetchInProgress.current = false;
          return;
        }
        if (profilesError) {
          logger.error("[loadAllLoras] Error fetching user profiles:", profilesError);
        } else if (profiles) {
          logger.log("[loadAllLoras] Fetched user profiles count:", profiles.length);
          userProfiles = profiles.reduce((acc, profile) => {
            acc[profile.id] = profile.display_name || profile.username || '';
            return acc;
          }, {} as Record<string, string>);
        }
      } else {
        logger.log("[loadAllLoras] No unique user IDs found, skipping profile fetch.");
      }

      logger.log("[loadAllLoras] Combining LoRAs with videos and profiles...");
      const lorasWithVideos = loraAssets?.map((asset) => {
        const primaryVideo = videos.find(v => v.id === asset.primary_media_id);
        const assetVideos = videos.filter(v =>
          v.metadata?.assetId === asset.id ||
          (v.metadata?.loraName &&
           v.metadata.loraName.toLowerCase() === (asset.name || '').toLowerCase())
        );
        const admin_approved = asset.admin_approved || 'Listed';
        const creatorDisplayName = asset.user_id && userProfiles[asset.user_id]
          ? userProfiles[asset.user_id]
          : asset.creator;
        return {
          ...asset,
          primaryVideo,
          videos: assetVideos,
          admin_approved,
          creatorDisplayName,
          model_variant: asset.model_variant
        } as LoraAsset;
      }) || [];

      logger.log("[loadAllLoras] Final combined LoRAs count:", lorasWithVideos.length);

      if (isMounted.current) {
        logger.log("[loadAllLoras] Setting loras state and isLoading = false");
        setLoras(lorasWithVideos);
        setIsLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      }
    } catch (error) {
      logger.error("[loadAllLoras] Error during fetch/processing:", error);
      if (isMounted.current) {
        toast.error("Error loading LoRAs. Please try again.");
        logger.log("[loadAllLoras] Setting isLoading = false after error");
        setIsLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      }
    } finally {
      if (isMounted.current) {
         logger.log("[loadAllLoras] FINALLY block: Setting fetchInProgress = false");
         fetchInProgress.current = false;
      } else {
         logger.log("[loadAllLoras] FINALLY block: Component unmounted, fetchInProgress remains", fetchInProgress.current);
      }
    }
  }, [videos, videosLoading]);

  useEffect(() => {
    logger.log(`[Effect Initial Load] Running. State: videosLoading=${videosLoading}, fetchAttempted=${fetchAttempted.current}, fetchInProgress=${fetchInProgress.current}`);
    if (!videosLoading && !fetchAttempted.current && !fetchInProgress.current) {
      logger.log("[Effect Initial Load] Videos loaded, triggering loadAllLoras.");
      loadAllLoras();
    } else if (videosLoading) {
      logger.log("[Effect Initial Load] Waiting for videos to load.");
    } else {
      logger.log("[Effect Initial Load] Already fetched or fetch in progress, skipping.");
    }
  }, [videosLoading, loadAllLoras]);

  useEffect(() => {
    logger.log('[Effect Mount] Setting isMounted = true');
    isMounted.current = true;
    return () => {
      logger.log('[Effect Unmount] Setting isMounted = false, clearing timeout');
      isMounted.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []);

  const refetchLoras = useCallback(async () => {
    logger.log('[refetchLoras] Attempting refetch...');
    if (isMounted.current && !fetchInProgress.current) {
      logger.log("[refetchLoras] Conditions met, calling loadAllLoras");
      fetchAttempted.current = false;
      await loadAllLoras();
      toast.success("LoRAs refreshed");
    } else {
      logger.log(`[refetchLoras] Skipping: isMounted=${isMounted.current}, fetchInProgress=${fetchInProgress.current}`);
    }
  }, [loadAllLoras]);

  logger.log(`useLoraManagement: Returning state - isLoading: ${isLoading}, loras count: ${loras.length}`);
  return {
    loras,
    isLoading,
    refetchLoras
  };
};
