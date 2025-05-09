import { useState, useCallback, useEffect, useRef } from 'react';
import { LoraAsset, AdminStatus } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';
import { checkIsAdmin } from '@/lib/auth';

const logger = new Logger('useLoraManagement', true, 'SessionPersist');

interface LoraFilters {
  modelFilter: string;
  approvalFilter: string;
  page?: number;      // 1-indexed page number
  pageSize?: number;  // Number of items per page
}

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 5000;

export const useLoraManagement = (filters: LoraFilters) => {
  const { modelFilter, approvalFilter, page = 1, pageSize = 0 } = filters;

  const [loras, setLoras] = useState<LoraAsset[]>([]);
  const [totalCount, setTotalCount] = useState(0); // New state for total count
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: isAuthLoading } = useAuth();
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  const loadLorasPage = useCallback(async () => {
    logger.log(`[loadLorasPage] Attempting load. Filters: model=${modelFilter}, approval=${approvalFilter}, page=${page}, pageSize=${pageSize}`);

    if (!isMounted.current) {
      logger.log("[loadLorasPage] Skip: Unmounted");
      return;
    }
    if (fetchInProgress.current) {
      logger.log("[loadLorasPage] Skip: Fetch in progress");
      return;
    }

    fetchInProgress.current = true;
    setIsLoading(true);
    logger.log('[loadLorasPage] Set isLoading=true, fetchInProgress=true');

    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (!isMounted.current) {
        logger.log(`[loadLorasPage] Abort attempt ${attempt}: Unmounted`);
        fetchInProgress.current = false;
        return;
      }

      logger.log(`[loadLorasPage] Starting attempt ${attempt}/${MAX_RETRIES}...`);

      try {
        const attemptStart = performance.now();
        // --- Actual Fetch Logic ---
        let query = supabase
          .from('assets')
          .select('*, primaryVideo:primary_media_id(*)', { count: 'exact' })
          .or(`type.ilike.%lora%,type.eq.LoRA,type.eq.lora,type.eq.Lora`);

        if (modelFilter && modelFilter !== 'all') {
          query = query.ilike('lora_base_model', modelFilter);
        }
        if (approvalFilter === 'curated') {
          query = query.in('admin_status', ['Featured', 'Curated']);
        } else if (approvalFilter === 'listed') {
          query = query.eq('admin_status', 'Listed');
        } else if (approvalFilter === 'all') {
          query = query.not('admin_status', 'in', '("Hidden", "Rejected")');
        }
        query = query.order('created_at', { ascending: false });

        if (pageSize > 0) {
          const rangeFrom = (page - 1) * pageSize;
          const rangeTo = rangeFrom + pageSize - 1;
          query = query.range(rangeFrom, rangeTo);
          logger.log(`[loadLorasPage] Applying range: ${rangeFrom} to ${rangeTo}`);
        } else {
          logger.log(`[loadLorasPage] No pageSize or pageSize is 0, fetching all matching assets.`);
        }

        const { data: loraAssets, error, count } = await query;

        if (!isMounted.current) {
          logger.log(`[loadLorasPage] Abort query fetch (attempt ${attempt}): Unmounted`);
          fetchInProgress.current = false;
          return;
        }
        if (error) {
          logger.error(`[loadLorasPage] Attempt ${attempt} - Supabase query error:`, error);
          throw error;
        }
        logger.log(`[loadLorasPage] Attempt ${attempt} - Fetched ${loraAssets?.length || 0} assets (page data), total potential count: ${count}`);

        // --- Profile Fetching ---
        const userIds = loraAssets?.filter(asset => asset.user_id).map(asset => asset.user_id) || [];
        const uniqueUserIds = [...new Set(userIds)].filter(Boolean) as string[];
        let userProfiles: Record<string, string> = {};

        if (uniqueUserIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', uniqueUserIds);

          if (!isMounted.current) {
            logger.log(`[loadLorasPage] Abort profile fetch (attempt ${attempt}): Unmounted`);
            fetchInProgress.current = false;
            return;
          }
          if (profilesError) {
            logger.error("[loadLorasPage] Error fetching user profiles:", profilesError);
          } else if (profiles) {
            userProfiles = profiles.reduce((acc, profile) => {
              acc[profile.id] = profile.display_name || profile.username || '';
              return acc;
            }, {} as Record<string, string>);
          }
        }

        // --- Processing & Sorting ---
        const processedLoras: LoraAsset[] = loraAssets?.map((asset) => {
          const pVideo = asset.primaryVideo;
          const creatorDisplayName = asset.user_id && userProfiles[asset.user_id]
            ? userProfiles[asset.user_id]
            : asset.creator;

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
            admin_status: asset.admin_status
          } as LoraAsset;
        }) || [];

        processedLoras.sort((a, b) => {
          const aIsFeatured = a.admin_status === 'Featured';
          const bIsFeatured = b.admin_status === 'Featured';
          if (aIsFeatured && !bIsFeatured) return -1;
          if (!aIsFeatured && bIsFeatured) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const attemptDuration = (performance.now() - attemptStart).toFixed(2);
        logger.log(`[loadLorasPage] Attempt ${attempt} completed in ${attemptDuration} ms`);
        logger.log(`[loadLorasPage] Attempt ${attempt} successful. Page count: ${processedLoras.length}, Total count: ${count}`);
        if (isMounted.current) {
          setLoras(processedLoras);
          setTotalCount(count ?? 0);
          setIsLoading(false);
          fetchInProgress.current = false;
          logger.log('[loadLorasPage] Set state: loras, totalCount, isLoading=false, fetchInProgress=false');
        } else {
          logger.log('[loadLorasPage] Success, but unmounted before state update.');
          fetchInProgress.current = false;
        }
        return;

      } catch (error) {
        lastError = error;
        logger.error(`[loadLorasPage] Attempt ${attempt}/${MAX_RETRIES} failed:`, error);

        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_DELAY_MS * attempt;
          logger.log(`[loadLorasPage] Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logger.error(`[loadLorasPage] Max retries (${MAX_RETRIES}) reached. Giving up. Last error:`, lastError);
          if (isMounted.current) {
              toast.error("Failed to load LoRAs after multiple attempts. Please refresh the page.", { duration: 10000 });
              setIsLoading(false);
              setTotalCount(0);
              fetchInProgress.current = false;
              logger.log('[loadLorasPage] Set state after max retries: isLoading=false, totalCount, fetchInProgress=false');
          } else {
               logger.log(`[loadLorasPage] Max retries reached, but unmounted.`);
               fetchInProgress.current = false;
          }
          break;
        }
      }
    } 

    if (isMounted.current && isLoading) {
      logger.warn("[loadLorasPage] Loop finished, forcing isLoading=false as a safeguard.");
      setIsLoading(false);
      fetchInProgress.current = false;
    }

  }, [modelFilter, approvalFilter, page, pageSize]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!fetchInProgress.current) {
      loadLorasPage();
    }
  }, [modelFilter, approvalFilter, page, pageSize, loadLorasPage]);

  const refetchLoras = useCallback(async () => {
    logger.log('[refetchLoras] Attempting explicit refetch...');
    if (isMounted.current && !fetchInProgress.current) {
      logger.log("[refetchLoras] Conditions met, calling loadLorasPage");
      await loadLorasPage();
    } else {
      logger.log(`[refetchLoras] Skipping: isMounted=${isMounted.current}, fetchInProgress=${fetchInProgress.current}`);
      if (fetchInProgress.current) {
        toast.info("Data is already being loaded.", { duration: 3000 });
      }
    }
  }, [loadLorasPage]);

  const setLoraAdminStatus = useCallback(async (assetId: string, status: AdminStatus): Promise<void> => {
    logger.log(`[setLoraAdminStatus] Setting status for asset ${assetId} to ${status}`);
    
    if (!user) {
      logger.error('[setLoraAdminStatus] No user logged in');
      toast.error('You must be logged in to change asset status');
      return;
    }
    
    try {
      // Check if user is admin
      const isUserAdmin = await checkIsAdmin(user.id);
      if (!isUserAdmin) {
        logger.error('[setLoraAdminStatus] Non-admin user attempted to set asset status');
        toast.error('Permission denied: Only admins can change admin status');
        return;
      }
      
      // Update the asset status
      const { data, error } = await supabase
        .from('assets')
        .update({ admin_status: status, admin_reviewed: true })
        .eq('id', assetId)
        .select('*')
        .single();
      
      if (error) {
        logger.error(`[setLoraAdminStatus] Error updating asset ${assetId} status:`, error);
        toast.error('Failed to update asset status');
        throw error;
      }
      
      // Optimistically update the local state
      setLoras(prevLoras => 
        prevLoras.map(lora => 
          lora.id === assetId ? { ...lora, admin_status: status } : lora
        )
      );
      
      logger.log(`[setLoraAdminStatus] Asset ${assetId} status updated to ${status}`);
      toast.success(`Asset status set to ${status}`);
    } catch (error) {
      logger.error('[setLoraAdminStatus] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    }
  }, [user]);

  return {
    loras,
    isLoading,
    totalCount,
    refetchLoras,
    setLoraAdminStatus
  };
};
