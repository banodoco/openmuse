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
  const [isLoading, setIsLoading] = useState(true); // Initialize to true
  const { user, isLoading: isAuthLoading } = useAuth();
  const isMounted = useRef(true);
  // fetchInProgress is removed as its previous usage caused issues.
  // We'll use fetchIdRef to ensure only the latest request updates state.
  const fetchIdRef = useRef(0);

  const loadAssetsPage = useCallback(async () => { // Renamed function
    const currentFetchId = ++fetchIdRef.current; // Increment and capture for this specific fetch attempt
    logger.log(`[loadAssetsPage] Called. currentFetchId=${currentFetchId}. Filters: assetType=${assetType}, model=${modelFilter}, approval=${approvalFilter}, page=${page}, pageSize=${pageSize}, userId=${userId}`);

    // setIsLoading(true) will be handled by the callers (useEffect/refetchAssets) to reflect intent.
    // If isLoading is not already true, this specific call can set it.
    // This ensures that if multiple calls are queued, isLoading remains true until the latest one settles.
    // However, it's cleaner if the trigger (useEffect/refetch) sets it. For now, let's ensure it's true here if not already.
    // if (!isLoading) setIsLoading(true); // Re-evaluating this, better to let callers manage setIsLoading(true)

    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (!isMounted.current) {
        logger.log(`[loadAssetsPage] Abort attempt ${attempt} (fetchId ${currentFetchId}): Unmounted`);
        return;
      }
      // Check if this fetch is still the latest one desired before starting an attempt
      if (currentFetchId !== fetchIdRef.current) {
        logger.log(`[loadAssetsPage] Stale fetch (fetchId ${currentFetchId}, current is ${fetchIdRef.current}) detected before attempt ${attempt}. Aborting.`);
        return;
      }

      logger.log(`[loadAssetsPage] Starting attempt ${attempt}/${MAX_RETRIES} for fetchId ${currentFetchId}...`);

      try {
        const attemptStart = performance.now();
        let query = supabase
          .from('assets')
          .select('*, primaryVideo:primary_media_id(*)', { count: 'exact' });

        // User ID Filter (applied first if present)
        if (userId) {
          query = query.eq('user_id', userId);
          logger.log(`[loadAssetsPage] (fetchId ${currentFetchId}) Applied userId filter: ${userId}`);
        } else {
          logger.warn(`[loadAssetsPage] (fetchId ${currentFetchId}) No userId provided. Query will not filter by user.`);
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
          logger.warn(`[loadAssetsPage] (fetchId ${currentFetchId}) Requested page is out of range (PGRST103).`);
          if (isMounted.current && currentFetchId === fetchIdRef.current) {
            setAssets([]);
            setTotalCount(count ?? 0);
            setIsLoading(false);
          }
          return;
        }

        if (!isMounted.current) {
          logger.log(`[loadAssetsPage] Abort query fetch (fetchId ${currentFetchId}, attempt ${attempt}): Unmounted`);
          return;
        }
        // Check again if this fetch is stale after the await
        if (currentFetchId !== fetchIdRef.current) {
            logger.log(`[loadAssetsPage] Stale fetch (fetchId ${currentFetchId}, current is ${fetchIdRef.current}) detected after query. Aborting state update.`);
            return;
        }
        if (error) {
          logger.error(`[loadAssetsPage] (fetchId ${currentFetchId}) Attempt ${attempt} - Supabase query error:`, error);
          throw error;
        }
        logger.log(`[loadAssetsPage] (fetchId ${currentFetchId}) Attempt ${attempt} - Fetched ${fetchedData?.length || 0} assets (page data), total potential count: ${count}`);

        const userIds = fetchedData?.filter(asset => asset.user_id).map(asset => asset.user_id) || [];
        const uniqueUserIds = [...new Set(userIds)].filter(Boolean) as string[];
        let userProfiles: Record<string, string> = {};

        if (uniqueUserIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', uniqueUserIds);

          if (!isMounted.current) {
            logger.log(`[loadAssetsPage] Abort profile fetch (fetchId ${currentFetchId}, attempt ${attempt}): Unmounted`);
            return;
          }
          // Check again for staleness
          if (currentFetchId !== fetchIdRef.current) {
            logger.log(`[loadAssetsPage] Stale fetch (fetchId ${currentFetchId}, current is ${fetchIdRef.current}) detected after profile fetch. Aborting state update.`);
            return;
          }
          if (profilesError) {
            logger.error(`[loadAssetsPage] (fetchId ${currentFetchId}) Error fetching user profiles:`, profilesError);
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
        logger.log(`[loadAssetsPage] (fetchId ${currentFetchId}) Attempt ${attempt} completed in ${attemptDuration} ms`);
        
        if (isMounted.current && currentFetchId === fetchIdRef.current) {
          logger.log(`[loadAssetsPage] fetchId ${currentFetchId} is current. Setting state.`);
          setAssets(processedAssets);
          setTotalCount(count ?? 0);
          setIsLoading(false); // Set loading false only when the LATEST request completes successfully.
        } else {
          logger.log(`[loadAssetsPage] fetchId ${currentFetchId} is STALE (current is ${fetchIdRef.current}) after success. Not setting state.`);
        }
        return;

      } catch (error) {
        lastError = error;
        logger.error(`[loadAssetsPage] (fetchId ${currentFetchId}) Attempt ${attempt}/${MAX_RETRIES} failed:`, error);
        if (attempt < MAX_RETRIES) {
          // Check for staleness before scheduling a retry
          if (currentFetchId !== fetchIdRef.current) {
            logger.log(`[loadAssetsPage] Stale fetch (fetchId ${currentFetchId}, current is ${fetchIdRef.current}) detected before retry. Aborting retry.`);
            return;
          }
          const delay = INITIAL_DELAY_MS * attempt;
          logger.log(`[loadAssetsPage] (fetchId ${currentFetchId}) Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logger.error(`[loadAssetsPage] (fetchId ${currentFetchId}) Max retries (${MAX_RETRIES}) reached. Last error:`, lastError);
          if (isMounted.current && currentFetchId === fetchIdRef.current) {
              toast.error(`Failed to load ${assetType || 'assets'} for ${userId || 'all users'}. Please refresh.`, { duration: 10000 });
              setIsLoading(false); // Set loading false only if this LATEST request failed completely.
              setAssets([]); // Clear assets on final failure of the latest request
              setTotalCount(0);
          } else {
               logger.log(`[loadAssetsPage] Max retries reached for STALE fetchId ${currentFetchId} (current is ${fetchIdRef.current}). Not updating state.`);
          }
          break; // Break from retry loop
        }
      }
    } 
    // If loop finishes due to max retries and it was for a stale fetch, isLoading might be incorrect.
    // Ensure isLoading is false if no up-to-date fetch completed.
    // This is tricky; the setIsLoading(false) should only be tied to the lifecycle of the *latest* fetchId.
    // The `setIsLoading(false)` in the try and catch (conditional on fetchId) should handle this.
  }, [assetType, modelFilter, approvalFilter, page, pageSize, userId, isMounted, setAssets, setTotalCount, setIsLoading, logger]); // Added stable setters, logger, isMounted

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Optionally, increment fetchIdRef here to invalidate any ongoing fetches upon unmount
      // fetchIdRef.current++; 
    };
  }, []);

  useEffect(() => {
    // When filters change, we want to initiate a new fetch.
    // Set loading to true to indicate a new fetch cycle is starting.
    logger.log(`[useEffect] Filters changed. Triggering loadAssetsPage. userId=${userId}, assetType=${assetType}`);
    setIsLoading(true); // Indicate that a new fetch process is starting due to filter change.
    loadAssetsPage();
    // loadAssetsPage itself will get the latest filters due to its useCallback dependencies.
  }, [userId, assetType, modelFilter, approvalFilter, page, pageSize, loadAssetsPage]); // loadAssetsPage is a dep so this runs when filters change

  const refetchAssets = useCallback(async () => { // Renamed function
    logger.log('[refetchAssets] Attempting explicit refetch...');
    if (isMounted.current) {
      logger.log("[refetchAssets] Conditions met, setting isLoading=true and calling loadAssetsPage");
      setIsLoading(true); // Indicate that a refetch process is starting.
      await loadAssetsPage();
    } else {
      logger.log(`[refetchAssets] Skipping: isMounted=${isMounted.current}`);
    }
  }, [loadAssetsPage, isMounted, setIsLoading]); // Added setIsLoading, isMounted

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