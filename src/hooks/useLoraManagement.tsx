import { useState, useCallback, useEffect, useRef } from 'react';
import { LoraAsset } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';

const logger = new Logger('useLoraManagement', true, 'SessionPersist');

interface LoraFilters {
  modelFilter: string;
  approvalFilter: string;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 5000;

export const useLoraManagement = (filters: LoraFilters) => {
  const { modelFilter, approvalFilter } = filters;

  const [loras, setLoras] = useState<LoraAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: isAuthLoading } = useAuth();
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  const loadAllLoras = useCallback(async () => {
    logger.log(`[loadAllLoras] Attempting load. Filters: model=${modelFilter}, approval=${approvalFilter}`);

    if (!isMounted.current) {
      logger.log("[loadAllLoras] Skip: Unmounted");
      return;
    }
    if (fetchInProgress.current) {
      logger.log("[loadAllLoras] Skip: Fetch in progress");
      return;
    }

    fetchInProgress.current = true;
    setIsLoading(true);
    logger.log('[loadAllLoras] Set isLoading=true, fetchInProgress=true');

    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (!isMounted.current) {
        logger.log(`[loadAllLoras] Abort attempt ${attempt}: Unmounted`);
        fetchInProgress.current = false;
        return;
      }

      logger.log(`[loadAllLoras] Starting attempt ${attempt}/${MAX_RETRIES}...`);

      try {
        const attemptStart = performance.now();
        // --- Actual Fetch Logic ---
        let query = supabase
          .from('assets')
          .select('*, primaryVideo:primary_media_id(*)')
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

        const { data: loraAssets, error } = await query;

        if (!isMounted.current) {
          logger.log(`[loadAllLoras] Abort query fetch (attempt ${attempt}): Unmounted`);
          fetchInProgress.current = false;
          return;
        }
        if (error) {
          // Ensure error object is passed to logger
          logger.error(`[loadAllLoras] Attempt ${attempt} - Supabase query error:`, error);
          throw error; // Trigger catch block for retry
        }
        logger.log(`[loadAllLoras] Attempt ${attempt} - Fetched ${loraAssets?.length || 0} assets (pre-profile)`);

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
            logger.log(`[loadAllLoras] Abort profile fetch (attempt ${attempt}): Unmounted`);
            fetchInProgress.current = false;
            return;
          }
          if (profilesError) {
            logger.error("[loadAllLoras] Error fetching user profiles:", profilesError);
            // Don't fail the whole fetch for profile errors
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
        logger.log(`[loadAllLoras] Attempt ${attempt} completed in ${attemptDuration} ms`);
        // --- Success ---
        logger.log(`[loadAllLoras] Attempt ${attempt} successful. Final count: ${processedLoras.length}`);
        if (isMounted.current) {
          setLoras(processedLoras);
          setIsLoading(false);
          fetchInProgress.current = false;
          logger.log('[loadAllLoras] Set state: loras, isLoading=false, fetchInProgress=false');
        } else {
          logger.log('[loadAllLoras] Success, but unmounted before state update.');
          fetchInProgress.current = false;
        }
        return; // Exit loop on success

      } catch (error) {
        lastError = error;
        logger.error(`[loadAllLoras] Attempt ${attempt}/${MAX_RETRIES} failed:`, error);

        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_DELAY_MS * attempt;
          logger.log(`[loadAllLoras] Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          // Continue to next iteration
        } else {
          // This block is reached after the last failed attempt
          logger.error(`[loadAllLoras] Max retries (${MAX_RETRIES}) reached. Giving up. Last error:`, lastError);
          if (isMounted.current) {
              toast.error("Failed to load LoRAs after multiple attempts. Please refresh the page.", { duration: 10000 });
              setIsLoading(false);
              fetchInProgress.current = false;
              logger.log('[loadAllLoras] Set state after max retries: isLoading=false, fetchInProgress=false');
          } else {
               logger.log(`[loadAllLoras] Max retries reached, but unmounted.`);
               fetchInProgress.current = false;
          }
          // Exit the loop after handling final failure
          break;
        }
      }
    } // End of retry loop

    // Code here runs only if the loop finished without success (e.g., unmounted during retries)
    // or after the final failure toast/state update.
    if (isMounted.current && isLoading) {
      // If somehow the loop finished but we are still loading (e.g., unmounted then remounted quickly?)
      // ensure loading is set to false.
      logger.warn("[loadAllLoras] Loop finished, forcing isLoading=false as a safeguard.");
      setIsLoading(false);
      fetchInProgress.current = false;
    }

  }, [modelFilter, approvalFilter]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!fetchInProgress.current) {
      loadAllLoras();
    }
  }, [modelFilter, approvalFilter, loadAllLoras]);

  const refetchLoras = useCallback(async () => {
    logger.log('[refetchLoras] Attempting explicit refetch...');
    if (isMounted.current && !fetchInProgress.current) {
      logger.log("[refetchLoras] Conditions met, calling loadAllLoras");
      await loadAllLoras();
    } else {
      logger.log(`[refetchLoras] Skipping: isMounted=${isMounted.current}, fetchInProgress=${fetchInProgress.current}`);
      if (fetchInProgress.current) {
        toast.info("Data is already being loaded.", { duration: 3000 });
      }
    }
  }, [loadAllLoras]);

  return {
    loras,
    isLoading,
    refetchLoras
  };
};
