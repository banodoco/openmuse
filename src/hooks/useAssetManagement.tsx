import { useState, useCallback, useEffect, useRef } from 'react';
import { AnyAsset, AdminStatus, AssetType, LoraAsset, WorkflowAsset, UserAssetPreferenceStatus } from '@/lib/types'; // Added UserAssetPreferenceStatus here
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';
import { checkIsAdmin } from '@/lib/auth';

const logger = new Logger('useAssetManagement', true, 'SessionPersist'); // Renamed logger

interface AssetFilters { // Renamed interface
  assetType?: AssetType; // Added assetType filter
  modelFilter?: string; // Kept for LoRAs, will be conditional
  approvalFilter: string;
  page?: number;
  pageSize?: number;
  userId?: string | null; // New: Optional user ID to filter by
}

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 5000;

export const useAssetManagement = (filters: AssetFilters) => { // Renamed hook
  const { assetType, modelFilter, approvalFilter, page = 1, pageSize = 0, userId } = filters;

  const [assets, setAssets] = useState<AnyAsset[]>([]); // Renamed state
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: isAuthLoading } = useAuth();
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);
  const [hasReceivedDefinedUserId, setHasReceivedDefinedUserId] = useState(Boolean(userId)); // New state

  const loadAssetsPage = useCallback(async () => { // Renamed function
    logger.log(`[loadAssetsPage] Attempting load. Filters: assetType=${assetType}, model=${modelFilter}, approval=${approvalFilter}, page=${page}, pageSize=${pageSize}, userId=${userId}`);

    if (!isMounted.current) {
      logger.log("[loadAssetsPage] Skip: Unmounted");
      return;
    }
    if (fetchInProgress.current) {
      logger.log("[loadAssetsPage] Skip: Fetch in progress");
      return;
    }

    fetchInProgress.current = true;
    setIsLoading(true);
    logger.log('[loadAssetsPage] Set isLoading=true, fetchInProgress=true');

    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (!isMounted.current) {
        logger.log(`[loadAssetsPage] Abort attempt ${attempt}: Unmounted`);
        fetchInProgress.current = false;
        return;
      }

      logger.log(`[loadAssetsPage] Starting attempt ${attempt}/${MAX_RETRIES}...`);

      try {
        const attemptStart = performance.now();
        let query = supabase
          .from('assets')
          .select('*, primaryVideo:primary_media_id(*)', { count: 'exact' });

        // User ID Filter (applied first if present)
        if (userId) {
          query = query.eq('user_id', userId);
          logger.log(`[loadAssetsPage] Applied userId filter: ${userId}`);
        }

        // Asset Type Filter
        if (assetType) {
          query = query.eq('type', assetType);
        } else {
          if (!userId) { // If no specific user, and no specific type, fetch all supported types
             query = query.in('type', ['lora', 'workflow']);
          } // If userId is present but no assetType, it will fetch all types for that user
        }

        // Model Filter (only apply if assetType is 'lora' or not specified and not a specific user workflow query)
        if (modelFilter && modelFilter !== 'all') {
          if (!assetType || assetType === 'lora') {
             query = query.ilike('lora_base_model', modelFilter);
          }
        }

        // Approval Filter (remains largely the same)
        if (approvalFilter === 'curated') {
          query = query.in('admin_status', ['Featured', 'Curated']);
        } else if (approvalFilter === 'listed') {
          query = query.eq('admin_status', 'Listed');
        } else if (approvalFilter === 'all') {
          // For 'all', fetch Listed, Curated, Featured (i.e., not Hidden or Rejected)
          query = query.not('admin_status', 'in', '("Hidden", "Rejected")');
        }
        
        // Default sort: Pinned by user first (if applicable, only for specific user queries), then by admin_status (Featured), then by creation date
        // This order might need adjustment based on desired global vs user-specific sorting
        if (userId) {
            query = query.order('user_status', { ascending: true, nullsFirst: false }); // Pinned, Listed, Hidden (nulls for not set by user)
        }
        query = query.order('admin_status', { 
            foreignTable: undefined, // Ensure this is how you specify for non-foreign table when multiple orders
            ascending: true, // Example: Featured > Curated > Listed (adjust array order for custom sort)
            // For custom sort order like Featured > Curated > Listed, you might need a CASE statement or fetch and sort client-side for this specific aspect.
            // Simple .order might not achieve specific string value priorities easily.
            // A common way is to add a numeric sort_priority column or map status to numbers client-side if complex.
            // For now, basic ascending by admin_status string value, then by created_at.
        });
        query = query.order('created_at', { ascending: false });

        if (pageSize > 0) {
          const rangeFrom = (page - 1) * pageSize;
          const rangeTo = rangeFrom + pageSize - 1;
          query = query.range(rangeFrom, rangeTo);
          logger.log(`[loadAssetsPage] Applying range: ${rangeFrom} to ${rangeTo}`);
        } else {
          logger.log(`[loadAssetsPage] No pageSize or pageSize is 0, fetching all matching assets.`);
        }

        const { data: fetchedData, error, count } = await query;

        if (error && (error as any).code === 'PGRST103') {
          logger.warn(`[loadAssetsPage] Requested page is out of range (PGRST103).`);
          if (isMounted.current) {
            setAssets([]);
            setTotalCount(count ?? 0);
            setIsLoading(false);
            fetchInProgress.current = false;
          }
          return;
        }

        if (!isMounted.current) {
          logger.log(`[loadAssetsPage] Abort query fetch (attempt ${attempt}): Unmounted`);
          fetchInProgress.current = false;
          return;
        }
        if (error) {
          logger.error(`[loadAssetsPage] Attempt ${attempt} - Supabase query error:`, error);
          throw error;
        }
        logger.log(`[loadAssetsPage] Attempt ${attempt} - Fetched ${fetchedData?.length || 0} assets (page data), total potential count: ${count}`);

        const userIds = fetchedData?.filter(asset => asset.user_id).map(asset => asset.user_id) || [];
        const uniqueUserIds = [...new Set(userIds)].filter(Boolean) as string[];
        let userProfiles: Record<string, string> = {};

        if (uniqueUserIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', uniqueUserIds);

          if (!isMounted.current) {
            logger.log(`[loadAssetsPage] Abort profile fetch (attempt ${attempt}): Unmounted`);
            fetchInProgress.current = false;
            return;
          }
          if (profilesError) {
            logger.error("[loadAssetsPage] Error fetching user profiles:", profilesError);
          } else if (profiles) {
            userProfiles = profiles.reduce((acc, profile) => {
              acc[profile.id] = profile.display_name || profile.username || '';
              return acc;
            }, {} as Record<string, string>);
          }
        }

        const processedAssets: AnyAsset[] = fetchedData?.map((dbAsset: any) => {
          const pVideo = dbAsset.primaryVideo;
          const creatorDisplayName = dbAsset.user_id && userProfiles[dbAsset.user_id]
            ? userProfiles[dbAsset.user_id]
            : dbAsset.creator;

          // Base asset structure
          const baseResult: Partial<AnyAsset> = {
            ...dbAsset,
            primaryVideo: pVideo ? {
              id: pVideo.id,
              url: pVideo.url,
              reviewer_name: pVideo.creator || '',
              skipped: false,
              created_at: pVideo.created_at,
              admin_status: pVideo.admin_status,
              user_id: pVideo.user_id,
              metadata: {
                title: pVideo.title || dbAsset.name,
                placeholder_image: pVideo.placeholder_image || null,
                description: pVideo.description,
                creator: pVideo.creator ? 'self' : undefined,
                creatorName: pVideo.creator_name,
                classification: pVideo.classification,
                assetId: dbAsset.id,
                // LoRA specific metadata fields, only relevant if it is a LoRA
                ...(dbAsset.type === 'lora' && {
                    loraName: dbAsset.name,
                    loraType: dbAsset.lora_type,
                    model: dbAsset.lora_base_model,
                    modelVariant: dbAsset.model_variant,
                })
              }
            } : undefined,
            creatorDisplayName: creatorDisplayName, // Add this if it was used in LoraAsset display
            // Ensure all fields from BaseAsset are correctly mapped
            id: dbAsset.id,
            name: dbAsset.name,
            description: dbAsset.description,
            creator: dbAsset.creator, // This is the original creator name from DB, not necessarily display name
            user_id: dbAsset.user_id,
            curator_id: dbAsset.curator_id,
            created_at: dbAsset.created_at,
            type: dbAsset.type as AssetType,
            admin_status: dbAsset.admin_status as AdminStatus | null,
            user_status: dbAsset.user_status as UserAssetPreferenceStatus | null,
            admin_reviewed: dbAsset.admin_reviewed ?? false,
            primary_media_id: dbAsset.primary_media_id,
            download_link: dbAsset.download_link,
          };

          let finalAsset: AnyAsset | null = null;
          if (dbAsset.type === 'lora') {
            finalAsset = {
              ...baseResult,
              type: 'lora',
              lora_type: dbAsset.lora_type,
              lora_base_model: dbAsset.lora_base_model,
              model_variant: dbAsset.model_variant,
              lora_link: dbAsset.lora_link,
            } as LoraAsset;
          } else if (dbAsset.type === 'workflow') {
            finalAsset = {
              ...baseResult,
              type: 'workflow',
              // No workflow-specific fields in DB other than type and download_link (handled in base)
            } as WorkflowAsset;
          }
          if (finalAsset) (finalAsset as any).creatorDisplayName = creatorDisplayName; // Add for display consistency
          return finalAsset;
        }).filter(Boolean) as AnyAsset[] || [];

        // Sorting is now primarily handled by DB query. Client-side sort can be a fallback or for complex criteria not easily done in SQL.
        // If client-side sort based on user_status (Pinned > Listed > Hidden) is still desired after DB sort:
        if (userId) { // Only apply this specific user-preference sort if we are fetching for a specific user
            processedAssets.sort((a, b) => {
                const statusOrder: { [key in UserAssetPreferenceStatus]?: number } = { 'Pinned': 1, 'Listed': 2, 'Hidden': 3 };
                const orderA = a.user_status ? (statusOrder[a.user_status] ?? 99) : 99; // Unset status last
                const orderB = b.user_status ? (statusOrder[b.user_status] ?? 99) : 99;
                if (orderA !== orderB) return orderA - orderB;
                // Fallback to other criteria if user_status is the same or not set
                const aIsFeatured = a.admin_status === 'Featured';
                const bIsFeatured = b.admin_status === 'Featured';
                if (aIsFeatured && !bIsFeatured) return -1;
                if (!aIsFeatured && bIsFeatured) return 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
        }

        const attemptDuration = (performance.now() - attemptStart).toFixed(2);
        logger.log(`[loadAssetsPage] Attempt ${attempt} completed in ${attemptDuration} ms`);
        logger.log(`[loadAssetsPage] Attempt ${attempt} successful. Page count: ${processedAssets.length}, Total count: ${count}`);
        if (isMounted.current) {
          setAssets(processedAssets);
          setTotalCount(count ?? 0);
          setIsLoading(false);
          fetchInProgress.current = false;
          logger.log('[loadAssetsPage] Set state: assets, totalCount, isLoading=false, fetchInProgress=false');
        } else {
          logger.log('[loadAssetsPage] Success, but unmounted before state update.');
          fetchInProgress.current = false;
        }
        return;

      } catch (error) {
        lastError = error;
        logger.error(`[loadAssetsPage] Attempt ${attempt}/${MAX_RETRIES} failed:`, error);
        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_DELAY_MS * attempt;
          logger.log(`[loadAssetsPage] Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logger.error(`[loadAssetsPage] Max retries (${MAX_RETRIES}) reached. Last error:`, lastError);
          if (isMounted.current) {
              toast.error(`Failed to load ${assetType || 'assets'} for ${userId || 'all users'}. Please refresh.`, { duration: 10000 });
              setIsLoading(false);
              setTotalCount(0);
              fetchInProgress.current = false;
              logger.log('[loadAssetsPage] Set state after max retries: isLoading=false, totalCount, fetchInProgress=false');
          } else {
               logger.log(`[loadAssetsPage] Max retries reached, but unmounted.`);
               fetchInProgress.current = false;
          }
          break;
        }
      }
    } 

    if (isMounted.current && isLoading) {
      logger.warn("[loadAssetsPage] Loop finished, forcing isLoading=false as a safeguard.");
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [assetType, modelFilter, approvalFilter, page, pageSize, userId]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // New logic to manage hasReceivedDefinedUserId
    if (userId && !hasReceivedDefinedUserId) {
        setHasReceivedDefinedUserId(true);
    }

    if (fetchInProgress.current) {
        logger.log("[useEffect loadAssetsPage] Skip: Fetch in progress");
        return;
    }

    // If the intention is to filter by a user (i.e., `filters.userId` was part of the hook's setup),
    // but we don't have a userId YET, and we've NEVER received one for this hook instance, then don't auto-load.
    // The explicit refetch from the calling component (like UserProfilePage) will trigger the load once userId is available.
    if (filters.hasOwnProperty('userId') && !userId && !hasReceivedDefinedUserId) {
        logger.log("[useEffect loadAssetsPage] Skipping initial automatic fetch: userId is expected but currently undefined, and has never been defined for this hook instance.");
        // Set isLoading to false if we skip the fetch, to avoid indefinite loading spinners.
        // The calling component (e.g., UserProfilePage) might manage its own loading state based on profile loading.
        if (isLoading) setIsLoading(false);
        return;
    }

    logger.log(`[useEffect loadAssetsPage] Proceeding to load. userId: ${userId}, hasOwnProperty: ${filters.hasOwnProperty('userId')}, hasReceivedDefinedUserId: ${hasReceivedDefinedUserId}`);
    loadAssetsPage();

  }, [userId, assetType, modelFilter, approvalFilter, page, pageSize, loadAssetsPage, filters, hasReceivedDefinedUserId, isLoading]); // Added filters, hasReceivedDefinedUserId, and isLoading to dependency array

  const refetchAssets = useCallback(async () => { // Renamed function
    logger.log('[refetchAssets] Attempting explicit refetch...');
    if (isMounted.current && !fetchInProgress.current) {
      logger.log("[refetchAssets] Conditions met, calling loadAssetsPage");
      await loadAssetsPage();
    } else {
      logger.log(`[refetchAssets] Skipping: isMounted=${isMounted.current}, fetchInProgress=${fetchInProgress.current}`);
      if (fetchInProgress.current) {
        toast.info("Data is already being loaded.", { duration: 3000 });
      }
    }
  }, [loadAssetsPage]);

  const setAssetAdminStatus = useCallback(async (assetId: string, status: AdminStatus): Promise<void> => { // Renamed function
    logger.log(`[setAssetAdminStatus] Setting status for asset ${assetId} to ${status}`);
    if (!user) {
      logger.error('[setAssetAdminStatus] No user logged in');
      toast.error('You must be logged in to change asset status');
      return;
    }
    try {
      const isUserAdmin = await checkIsAdmin(user.id);
      if (!isUserAdmin) {
        logger.error('[setAssetAdminStatus] Non-admin user attempted to set asset status');
        toast.error('Permission denied: Only admins can change admin status');
        return;
      }
      const { error } = await supabase
        .from('assets')
        .update({ admin_status: status, admin_reviewed: true })
        .eq('id', assetId);
      if (error) {
        logger.error(`[setAssetAdminStatus] Error updating asset ${assetId} status:`, error);
        toast.error('Failed to update asset status');
        throw error;
      }
      setAssets(prevAssets => // Renamed state variable
        prevAssets.map(assetItem => 
          assetItem.id === assetId ? { ...assetItem, admin_status: status } : assetItem
        )
      );
      logger.log(`[setAssetAdminStatus] Asset ${assetId} status updated to ${status}`);
      toast.success(`Asset status set to ${status}`);
    } catch (error) {
      logger.error('[setAssetAdminStatus] Unexpected error:', error);
      // Avoid throwing here to prevent unhandled promise rejection if caller doesn't catch
    }
  }, [user]); // Removed setAssets from dependency array as it's a state setter

  return {
    assets, // Renamed
    isLoading,
    totalCount,
    refetchAssets, // Renamed
    setAssetAdminStatus // Renamed
  };
}; 