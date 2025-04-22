import { useState, useCallback, useEffect, useRef } from 'react';
import { LoraAsset } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVideoManagement } from './useVideoManagement';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';

const logger = new Logger('useLoraManagement');
logger.log('useLoraManagement hook initializing');

// Define filter types
interface LoraFilters {
  modelFilter: string; // e.g., 'all', 'wan', 'ltxv'
  approvalFilter: string; // e.g., 'curated', 'listed', 'all'
}

export const useLoraManagement = (filters: LoraFilters) => {
  const { modelFilter, approvalFilter } = filters;
  logger.log(`useLoraManagement executing with filters: model=${modelFilter}, approval=${approvalFilter}`);
  
  const [loras, setLoras] = useState<LoraAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: isAuthLoading } = useAuth();
  const { videos, isLoading: videosLoading } = useVideoManagement();
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false); // Maybe remove this if filters trigger fetches
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
    logger.log(`[loadAllLoras] Attempting to load... Filters: model=${modelFilter}, approval=${approvalFilter}`);
    
    if (!isMounted.current) {
      logger.log("[loadAllLoras] Skipping: Component unmounted");
      return;
    }
    if (fetchInProgress.current) {
      logger.log("[loadAllLoras] Skipping: Fetch already in progress");
      return;
    }

    logger.log('[loadAllLoras] Conditions met. Setting fetchInProgress=true, isLoading=true');
    fetchInProgress.current = true;
    setIsLoading(true);
    // fetchAttempted.current = true; // Let filter changes reset this if needed?
    logger.log("[loadAllLoras] Fetching LoRA assets from Supabase with filters...");

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
        .select('*, primaryVideo:primary_media_id(*)')
        .or(`type.ilike.%lora%,type.eq.LoRA,type.eq.lora,type.eq.Lora`);

      // Apply model filter if not 'all'
      if (modelFilter && modelFilter !== 'all') {
         logger.log(`[loadAllLoras] Applying model filter: ${modelFilter}`);
         query = query.ilike('lora_base_model', modelFilter);
      }

      // Apply approval status filter based on the prop
      logger.log(`[loadAllLoras] Applying status filter: ${approvalFilter}`);
      if (approvalFilter === 'curated') {
        query = query.in('admin_status', ['Featured', 'Curated']);
      } else if (approvalFilter === 'listed') {
        query = query.eq('admin_status', 'Listed');
      } else if (approvalFilter === 'all') {
        // Fetch all that are not explicitly Hidden or Rejected
        query = query.not('admin_status', 'in', '("Hidden", "Rejected")');
      } // Implicitly defaults to curated if value is unexpected?
      // Or add explicit default: else { query = query.in('admin_status', ['Featured', 'Curated']); }

      // Keep original ordering by date (will be re-sorted client-side later)
      query = query.order('created_at', { ascending: false });

      const { data: loraAssets, error } = await query;

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
      logger.log("[loadAllLoras] Fetched LoRA assets count (post-filter):", loraAssets?.length || 0);

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

      logger.log("[loadAllLoras] Combining LoRAs with profiles...");
      const processedLoras: LoraAsset[] = loraAssets?.map((asset) => {
        const pVideo = asset.primaryVideo;
        const creatorDisplayName = asset.user_id && userProfiles[asset.user_id]
          ? userProfiles[asset.user_id]
          : asset.creator;
        
        logger.log(`[loadAllLoras] Processing asset ${asset.id}. Joined pVideo exists: ${!!pVideo}`);
        
        return {
          ...asset, 
          primaryVideo: pVideo ? { 
              id: pVideo.id,
              url: pVideo.url,
              reviewer_name: pVideo.creator || '', 
              skipped: false,
              created_at: pVideo.created_at,
              admin_status: pVideo.admin_status,
              user_id: pVideo.user_id,
              metadata: {
                  title: pVideo.title || asset.name,
                  placeholder_image: pVideo.placeholder_image || null,
                  description: pVideo.description, 
                  creator: pVideo.creator ? 'self' : undefined,
                  creatorName: pVideo.creator_name,
                  classification: pVideo.classification,
                  loraName: asset.name,
                  assetId: asset.id,
                  loraType: asset.lora_type,
                  model: asset.lora_base_model,
                  modelVariant: asset.model_variant,
              }
          } : undefined,
          creatorDisplayName: creatorDisplayName,
          // Use the correct admin_status field from the fetched asset data
          admin_status: asset.admin_status 
        } as LoraAsset;
      }) || [];

      logger.log("[loadAllLoras] Applying sorting: Featured first, then by date...");
      // Sort: Featured first, then by creation date descending
      processedLoras.sort((a, b) => {
        const aIsFeatured = a.admin_status === 'Featured';
        const bIsFeatured = b.admin_status === 'Featured';

        if (aIsFeatured && !bIsFeatured) {
          return -1; // a comes first
        }
        if (!aIsFeatured && bIsFeatured) {
          return 1; // b comes first
        }

        // If both are featured or both are not, sort by date descending
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      logger.log("[loadAllLoras] Final sorted LoRAs count:", processedLoras.length);

      if (isMounted.current) {
        logger.log("[loadAllLoras] Setting loras state and isLoading = false");
        setLoras(processedLoras);
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
  // Depend on filters ONLY (remove videos/videosLoading dependency here if not needed for processing)
  }, [modelFilter, approvalFilter]); 

  useEffect(() => {
    // This effect triggers loadAllLoras when filters change
    logger.log(`[Effect Load/Refetch] Running. Filters: model=${modelFilter}, approval=${approvalFilter}`);
    if (!fetchInProgress.current) { // Only trigger if not already fetching
      logger.log("[Effect Load/Refetch] Triggering loadAllLoras due to filter change or initial load.");
      loadAllLoras();
    } else {
      logger.log("[Effect Load/Refetch] Fetch already in progress, skipping trigger.");
    }
  // Depend only on filters and loadAllLoras callback reference
  }, [modelFilter, approvalFilter, loadAllLoras]); 

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

  // Refetch function might need adjustment if loadAllLoras is automatically called on filter change
  const refetchLoras = useCallback(async () => {
    logger.log('[refetchLoras] Attempting explicit refetch...');
    if (isMounted.current && !fetchInProgress.current) {
      logger.log("[refetchLoras] Conditions met, calling loadAllLoras");
      // No need to set fetchAttempted.current = false anymore?
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
    refetchLoras // Keep refetchLoras for manual refresh scenarios
  };
};
