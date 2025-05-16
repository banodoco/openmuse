import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnyAsset, VideoEntry, VideoDisplayStatus, VideoMetadata, AdminStatus, UserAssetPreferenceStatus, UserProfile, AssetType, LoraAsset, WorkflowAsset } from '@/lib/types';
import { toast } from 'sonner';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { sortAssetPageVideos } from '@/lib/utils/videoUtils';
import { useMockRoleContext } from '@/contexts/MockRoleContext';

const logger = new Logger('useAssetDetails');
const MOCK_OWNER_MARKER_USER_ID = '---MOCK_ASSET_OWNER_USER---';

// Helper type guard for allowed model strings
const isValidModel = (model: string | undefined): model is VideoMetadata['model'] => {
  if (!model) return false;
  const allowedModels = ['wan', 'hunyuan', 'ltxv', 'cogvideox', 'animatediff'];
  return allowedModels.includes(model.toLowerCase());
};

export const useAssetDetails = (assetId: string | undefined) => {
  const [asset, setAsset] = useState<AnyAsset | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataFetchAttempted, setDataFetchAttempted] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  const [curatorProfile, setCuratorProfile] = useState<UserProfile | null>(null);
  const [isLoadingCuratorProfile, setIsLoadingCuratorProfile] = useState(false);
  const [isUpdatingAdminStatus, setIsUpdatingAdminStatus] = useState(false);
  const { user, isAdmin, isLoading: isAuthLoading } = useAuth();
  const { mockRole, mockOwnerId, isStaging } = useMockRoleContext();

  const initialFetchTriggered = useRef(false);
  const assetRef = useRef<string | undefined>(undefined);

  logger.log('[LoraLoadSpeed] useAssetDetails hook initialized.');

  const fetchAssetDetails = useCallback(async (options?: { silent?: boolean }) => {
    const fetchStartTime = performance.now();
    logger.log(`[LoraLoadSpeed] fetchAssetDetails started for assetId: ${assetId}. Silent: ${options?.silent}`);
    if (!assetId) {
      logger.warn('[useAssetDetails] fetchAssetDetails called without assetId.');
      toast.error('No asset ID provided');
      if (!options?.silent) setIsLoading(false);
      setDataFetchAttempted(true);
      initialFetchTriggered.current = true;
      setCuratorProfile(null);
      return;
    }

    logger.log('[LoraLoadSpeed] [useAssetDetails] Starting fetchAssetDetails for ID:', assetId);
    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      logger.log('[LoraLoadSpeed] [useAssetDetails] Fetching core asset details for ID:', assetId);
      const coreAssetFetchStart = performance.now();
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('id, name, description, creator, type, created_at, user_id, primary_media_id, admin_status, user_status, lora_type, lora_base_model, model_variant, lora_link, download_link, admin_reviewed, curator_id')
        .eq('id', assetId)
        .maybeSingle();

      if (assetError) {
        logger.error('[LoraLoadSpeed] [useAssetDetails] Error fetching asset:', assetError);
        throw assetError;
      }
      logger.log(`[LoraLoadSpeed] [useAssetDetails] Fetched core asset details in ${performance.now() - coreAssetFetchStart}ms. Has data: ${!!assetData}`);

      let primaryVideoData: VideoEntry | null = null;
      if (assetData && assetData.primary_media_id) {
        logger.log('[LoraLoadSpeed] [useAssetDetails] Fetching primary video details for media ID:', assetData.primary_media_id);
        const primaryVideoFetchStart = performance.now();
        const { data: pVideoData, error: pVideoError } = await supabase
          .from('media')
          .select('*')
          .eq('id', assetData.primary_media_id)
          .maybeSingle();
        
        if (pVideoError) {
          logger.error('[LoraLoadSpeed] [useAssetDetails] Error fetching primary video:', pVideoError);
        } else {
          primaryVideoData = pVideoData as VideoEntry | null;
        }
        logger.log(`[LoraLoadSpeed] [useAssetDetails] Fetched primary video in ${performance.now() - primaryVideoFetchStart}ms. Has data: ${!!primaryVideoData}`);
      }

      logger.log('[LoraLoadSpeed] [useAssetDetails] Fetching asset_media joined data for ID:', assetId);
      const assetMediaFetchStart = performance.now();
      const { data: assetMediaJoinData, error: assetMediaJoinError } = await supabase
        .from('asset_media')
        .select(`
          status,
          is_primary,
          asset_id,
          media:media_id!inner(*)
        `)
        .eq('asset_id', assetId);

      if (assetMediaJoinError) {
        logger.error('[LoraLoadSpeed] [useAssetDetails] Error fetching asset_media joined data:', assetMediaJoinError);
        throw assetMediaJoinError;
      }
      logger.log(`[LoraLoadSpeed] [useAssetDetails] Fetched asset_media joined data in ${performance.now() - assetMediaFetchStart}ms. Count: ${assetMediaJoinData?.length || 0}`);

      if (!assetData) {
        logger.warn('[LoraLoadSpeed] [useAssetDetails] No asset found with ID:', assetId);
        setAsset(null);
        setVideos([]);
        setCuratorProfile(null);
      } else {
        logger.log(`[LoraLoadSpeed] [useAssetDetails] Fetched asset user_status: ${assetData.user_status}`);
      }

      const fetchedAssetMedia = assetMediaJoinData || [];
      logger.log(`[LoraLoadSpeed] [useAssetDetails] Fetched ${fetchedAssetMedia.length} asset_media join records.`);

      const pVideo = primaryVideoData;
      logger.log(`[VideoLightboxDebug] Processing asset: ${assetData?.id}, Fetched Primary Video Data (pVideo):`, {
          exists: !!pVideo,
          id: pVideo?.id,
          url: pVideo?.url,
          placeholder: pVideo?.placeholder_image,
          title: pVideo?.title
      });

      const validModel = isValidModel(assetData?.lora_base_model) ? assetData?.lora_base_model : undefined;

      if (assetData) {
        const baseAssetFields: Partial<AnyAsset> = {
            id: assetData.id,
            name: assetData.name,
            description: assetData.description,
            creator: assetData.creator,
            type: assetData.type as AssetType,
            created_at: assetData.created_at,
            user_id: assetData.user_id,
            primary_media_id: assetData.primary_media_id,
            admin_status: assetData.admin_status as AdminStatus | null,
            user_status: assetData.user_status as UserAssetPreferenceStatus | null,
            admin_reviewed: assetData.admin_reviewed ?? false,
            curator_id: assetData.curator_id,
            download_link: assetData.download_link,
            primaryVideo: pVideo ? {
                id: pVideo.id,
                url: pVideo.url,
                reviewer_name: (pVideo as any)?.creator || '',
                skipped: false,
                created_at: pVideo.created_at,
                assetMediaDisplayStatus: (pVideo as any)?.status as VideoDisplayStatus || 'Listed',
                user_id: pVideo.user_id,
                user_status: (pVideo as any)?.user_status as VideoDisplayStatus || null,
                admin_status: (pVideo as any)?.admin_status as AdminStatus || null,
                metadata: {
                    title: pVideo.title || assetData.name || '',
                    placeholder_image: pVideo.placeholder_image || null,
                    description: pVideo.description || '',
                    classification: (pVideo as any)?.classification || 'gen',
                    assetId: assetData.id,
                    ...(assetData.type === 'lora' && {
                        loraName: assetData.name,
                        loraType: assetData.lora_type,
                        model: isValidModel(assetData.lora_base_model) ? assetData.lora_base_model : undefined,
                        modelVariant: assetData.model_variant,
                    })
                }
            } : undefined
        };
        
        let processedAsset: AnyAsset | null = null;
        if (assetData.type === 'lora') {
            processedAsset = {
                ...(baseAssetFields as LoraAsset),
                type: 'lora',
                lora_type: assetData.lora_type,
                lora_base_model: assetData.lora_base_model,
                model_variant: assetData.model_variant,
                lora_link: assetData.lora_link,
            } as LoraAsset;
        } else if (assetData.type === 'workflow') {
            processedAsset = {
                ...(baseAssetFields as WorkflowAsset),
                type: 'workflow',
                // Explicitly map model fields for workflows from the shared DB columns
                lora_base_model: assetData.lora_base_model || null,
                model_variant: assetData.model_variant || null,
            } as WorkflowAsset;
        }
        setAsset(processedAsset);

        if (assetData.curator_id) {
          logger.log(`[LoraLoadSpeed] [useAssetDetails] Found curator_id: ${assetData.curator_id}. Fetching curator profile.`);
          setIsLoadingCuratorProfile(true);
          const curatorFetchStart = performance.now();
          try {
            const { data: curatorData, error: curatorError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', assetData.curator_id)
              .maybeSingle();

            if (curatorError) {
              logger.error('[LoraLoadSpeed] [useAssetDetails] Error fetching curator profile:', curatorError);
              setCuratorProfile(null);
            } else {
              logger.log('[LoraLoadSpeed] [useAssetDetails] Successfully fetched curator profile:', curatorData);
              setCuratorProfile(curatorData as UserProfile | null);
            }
            logger.log(`[LoraLoadSpeed] [useAssetDetails] Fetched curator profile in ${performance.now() - curatorFetchStart}ms.`);
          } catch (err) {
            logger.error('[LoraLoadSpeed] [useAssetDetails] Exception fetching curator profile:', err);
            setCuratorProfile(null);
          } finally {
            setIsLoadingCuratorProfile(false);
          }
        } else {
          logger.log('[LoraLoadSpeed] [useAssetDetails] No curator_id found for this asset.');
          setCuratorProfile(null);
          setIsLoadingCuratorProfile(false);
        }

        logger.log(`[LoraLoadSpeed] [useAssetDetails] Starting video processing for ${fetchedAssetMedia.length} items.`);
        const videoProcessingStart = performance.now();
        const convertedVideos: VideoEntry[] = await Promise.all(
          fetchedAssetMedia
            .filter(item => item.media) 
            .map(async (item: any) => {
            const media = item.media;
            try {
              const videoUrl = media.url ? await videoUrlService.getVideoUrl(media.url) : null;
              if (!videoUrl) {
                logger.warn(`[useAssetDetails] Could not get video URL for media ID: ${media.id}`);
                return null;
              }
              
              const isPrimary = item.is_primary === true; 
              const assignedStatus = (item.status as VideoDisplayStatus) || 'Listed'; 
              logger.log(`[loraorderingbug] Processing Video ${media.id}: Assigned status '${assignedStatus}' (from asset_media.status: ${item.status}, is_primary: ${item.is_primary})`);
  
              const videoMetadata: Partial<VideoMetadata> = {
                  title: media.title || '',
                  description: media.description || '',
                  placeholder_image: media.placeholder_image || null,
                  classification: media.classification || 'gen',
                  assetId: item.asset_id,
                  aspectRatio: (media.metadata as any)?.aspectRatio ?? null
              };

              if (processedAsset.type === 'lora') {
                  const lora = processedAsset as LoraAsset;
                  videoMetadata.loraName = lora.name;
                  videoMetadata.loraDescription = lora.description;
                  videoMetadata.loraType = lora.lora_type;
                  videoMetadata.loraLink = lora.lora_link;
                  videoMetadata.model = isValidModel(lora.lora_base_model) ? lora.lora_base_model : undefined;
                  videoMetadata.modelVariant = lora.model_variant;
              }

              return {
                id: media.id,
                url: videoUrl,
                associatedAssetId: item.asset_id,
                is_primary: isPrimary,
                reviewer_name: media.creator || 'Unknown',
                skipped: false,
                created_at: media.created_at,
                assetMediaDisplayStatus: assignedStatus,
                user_id: media.user_id,
                user_status: (media.user_status as VideoDisplayStatus) || null,
                metadata: videoMetadata as VideoMetadata,
                admin_status: media.admin_status as AdminStatus || null,
              };
            } catch (error) {
              logger.error(`[useAssetDetails] Error processing video ${media.id}:`, error);
              return null;
            }
          })
        );
  
        logger.log(`[LoraLoadSpeed] [useAssetDetails] Video processing (including URL signing) took ${performance.now() - videoProcessingStart}ms.`);
        const validVideos = convertedVideos.filter(v => v !== null) as VideoEntry[];
        logger.log(`[LoraLoadSpeed] [useAssetDetails] Processed ${validVideos.length} valid videos from join data.`);
  
        const isViewerAuthorized = isAdmin || (!!user && user.id === assetData?.user_id);
        logger.log(`[LoraLoadSpeed] [useAssetDetails] Viewer authorization check: isAdmin=${isAdmin}, user.id=${user?.id}, asset.user_id=${assetData?.user_id}, isAuthorized=${isViewerAuthorized}`);
  
        const filteredVideos = isViewerAuthorized
          ? validVideos
          : validVideos.filter(v => v.assetMediaDisplayStatus !== 'Hidden');
        logger.log(`[LoraLoadSpeed] [useAssetDetails] Filtered videos count (Hidden removed for non-auth): ${filteredVideos.length}`);
  
        const sortedVideos = sortAssetPageVideos(filteredVideos, assetData?.primary_media_id);
        logger.log(`[LoraLoadSpeed] [useAssetDetails] Sorted videos count: ${sortedVideos.length}`);
  
        logger.log('[LoraLoadSpeed] [loraorderingbug] Final sorted video IDs and statuses (before setting state):', sortedVideos.map(v => `${v.id} (Status: ${v.assetMediaDisplayStatus}, Primary: ${v.is_primary})`));
  
        logger.log(`[LoraLoadSpeed] [useAssetDetails] Setting videos state with ${sortedVideos.length} videos.`);
        setVideos(sortedVideos);

      } else {
        logger.log('[LoraLoadSpeed] [useAssetDetails] Asset data was null, skipping video processing and state updates.');
      }

    } catch (error) {
      logger.error('[LoraLoadSpeed] [useAssetDetails] Error in fetchAssetDetails:', error);
      toast.error('Failed to load asset details');
      setAsset(null);
      setVideos([]);
      setCuratorProfile(null);
    } finally {
      logger.log(`[LoraLoadSpeed] [useAssetDetails] fetchAssetDetails finally block executing. Current isLoading: ${isLoading}`);
      if (!options?.silent) {
        setIsLoading(false);
        logger.log(`[LoraLoadSpeed] [useAssetDetails] setIsLoading(false) called. Silent: ${options?.silent}`);
      }
      setDataFetchAttempted(true);
      logger.log(`[LoraLoadSpeed] fetchAssetDetails finished in ${performance.now() - fetchStartTime}ms for assetId: ${assetId}.`);
    }
  }, [assetId, user, isAdmin]);

  useEffect(() => {
    logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] assetId: ${assetId}, isAuthLoading: ${isAuthLoading}, initialFetchTriggered: ${initialFetchTriggered.current}, dataFetchAttempted: ${dataFetchAttempted}, current isLoading: ${isLoading}`);

    const assetIdChanged = assetId !== assetRef.current;

    if (assetIdChanged) {
        logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] Asset ID changed from ${assetRef.current} to ${assetId}. Resetting state and fetch trigger.`);
        assetRef.current = assetId;
        setAsset(null);
        setVideos([]);
        setCreatorDisplayName(null);
        setDataFetchAttempted(false);
        initialFetchTriggered.current = false;
        setIsLoading(true);
    }

    if (assetId && !isAuthLoading && !initialFetchTriggered.current) {
      logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] Conditions met. Calling fetchAssetDetails for ${assetId}.`);
      initialFetchTriggered.current = true;
      fetchAssetDetails();
    } else if (isAuthLoading) {
       logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] Waiting for auth to load before fetching ${assetId}.`);
       if (!isLoading) setIsLoading(true);
    } else if (!assetId) {
       logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] No assetId, clearing state and stopping loading.`);
       if (asset) setAsset(null);
       if (videos.length > 0) setVideos([]);
       if (creatorDisplayName) setCreatorDisplayName(null);
       if (isLoading) setIsLoading(false);
       if (dataFetchAttempted) setDataFetchAttempted(false);
       initialFetchTriggered.current = false;
       logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] No assetId path, final isLoading: ${isLoading}, dataFetchAttempted: ${dataFetchAttempted}`);
    } else if (assetId && !isAuthLoading && initialFetchTriggered.current) {
       logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] Auth ready, but fetch already triggered for ${assetId}. Current loading: ${isLoading}, Attempted: ${dataFetchAttempted}`);
       if (isLoading && dataFetchAttempted) {
           logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] Fetch completed or failed, ensuring loading is false.`);
           setIsLoading(false);
       }
    } else {
        logger.log(`[LoraLoadSpeed] [useAssetDetails Effect Trigger] Unhandled state or condition. assetId=${assetId}, isAuthLoading=${isAuthLoading}, initialFetchTriggered=${initialFetchTriggered.current}`);
    }
  }, [assetId, isAuthLoading, fetchAssetDetails, isLoading, dataFetchAttempted]);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (!asset?.user_id) {
          if (creatorDisplayName !== null) {
              logger.log(`[LoraLoadSpeed] [useAssetDetails CreatorProfile Effect] No asset.user_id, clearing creatorDisplayName.`);
              setCreatorDisplayName(null);
          }
          return;
      }

      logger.log(`[LoraLoadSpeed] [useAssetDetails CreatorProfile Effect] Fetching profile for creator ID: ${asset.user_id} with cache:no-store attempt.`);
      const creatorProfileFetchStart = performance.now();
      try {
          const { data: profile, error } = await supabase
              .from('profiles')
              .select('display_name, username', { 
                // @ts-ignore 
                fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' })
              })
              .eq('id', asset.user_id)
              .maybeSingle();

          if (error) {
              logger.error(`[LoraLoadSpeed] [useAssetDetails CreatorProfile Effect] Error fetching profile for ${asset.user_id}:`, error);
              setCreatorDisplayName(null);
          } else if (profile) {
              setCreatorDisplayName(profile.display_name || profile.username);
          } else {
              setCreatorDisplayName(null);
          }
          logger.log(`[LoraLoadSpeed] [useAssetDetails CreatorProfile Effect] Fetched creator profile in ${performance.now() - creatorProfileFetchStart}ms.`);
      } catch (fetchError) {
          logger.error(`[LoraLoadSpeed] [useAssetDetails CreatorProfile Effect] Exception during profile fetch for ${asset.user_id}:`, fetchError);
          setCreatorDisplayName(null);
      }
    };

    if (asset?.user_id) {
      fetchCreatorProfile();
    } else {
      if (creatorDisplayName !== null) {
        logger.log(`[LoraLoadSpeed] [useAssetDetails CreatorProfile Effect] asset.user_id is null, clearing creatorDisplayName.`);
        setCreatorDisplayName(null);
      }
    }
  }, [asset?.user_id]);

  const getCreatorName = () => {
    return creatorDisplayName || asset?.creator || 'Unknown';
  };
  
  const updateAssetUserStatus = useCallback(async (newStatus: UserAssetPreferenceStatus) => {
    const isAuthorized = isAdmin || (!!user && user.id === asset?.user_id);
    if (!isAuthorized || !asset) { toast.error("Permission denied or asset not loaded."); return; }
    const optimisticPreviousStatus = asset.user_status;
    setAsset(prev => prev ? { ...prev, user_status: newStatus } as AnyAsset : null);
    try {
        logger.log(`[updateAssetUserStatus] Updating asset ${asset.id} user_status to ${newStatus}`);
        const { error } = await supabase
            .from('assets')
            .update({ user_status: newStatus })
            .eq('id', asset.id);
        if (error) throw error;
        toast.success(`Asset status updated to ${newStatus}`);
    } catch (error) {
        logger.error(`[updateAssetUserStatus] Error setting status to ${newStatus}:`, error);
        toast.error(`Failed to set status to ${newStatus}`);
        setAsset(prev => prev ? { ...prev, user_status: optimisticPreviousStatus } as AnyAsset : null);
    }
  }, [asset, user, isAdmin]);

  const updateLocalVideoStatus = useCallback((videoId: string, newStatus: VideoDisplayStatus, type: 'assetMedia' | 'user') => {
    setVideos(prevVideos => sortAssetPageVideos(prevVideos.map(video => 
        video.id === videoId ? { ...video, assetMediaDisplayStatus: type === 'assetMedia' ? newStatus : video.assetMediaDisplayStatus, user_status: type === 'user' ? newStatus : video.user_status } : video
    ), asset?.primary_media_id));
  }, [asset?.primary_media_id]);

  const updateLocalPrimaryMedia = useCallback((newPrimaryMediaId: string | null) => {
    setAsset(prevAsset => prevAsset && prevAsset.primary_media_id !== newPrimaryMediaId ? { ...prevAsset, primary_media_id: newPrimaryMediaId } as AnyAsset : prevAsset);
    setVideos(prevVideos => sortAssetPageVideos(prevVideos.map(v => ({...v, is_primary: v.id === newPrimaryMediaId})), newPrimaryMediaId));
    logger.log(`[useAssetDetails] Primary media ID updated locally to ${newPrimaryMediaId}. Videos re-sorted.`);
  }, []);
  
  const removeVideoLocally = useCallback((videoId: string) => {
    setVideos(prevVideos => prevVideos.filter(v => v.id !== videoId));
    logger.log(`[useAssetDetails] Video ${videoId} removed locally.`);
  }, []);

  const updateAssetAdminStatus = useCallback(async (newStatus: AdminStatus) => {
    if (!isAdmin || !asset) { toast.error("Permission denied or asset not loaded."); return; }
    const optimisticPreviousStatus = asset.admin_status;
    setIsUpdatingAdminStatus(true);
    setAsset(prev => prev ? { ...prev, admin_status: newStatus } as AnyAsset : null);
    try {
        logger.log(`[updateAssetAdminStatus] Updating asset ${asset.id} admin_status to ${newStatus}`);
        const { error } = await supabase
            .from('assets')
            .update({ admin_status: newStatus })
            .eq('id', asset.id);
        if (error) throw error;
        toast.success(`Asset admin status updated to ${newStatus}`);
    } catch (error) {
        logger.error(`[updateAssetAdminStatus] Error setting admin status to ${newStatus}:`, error);
        toast.error(`Failed to set admin status to ${newStatus}`);
        setAsset(prev => prev ? { ...prev, admin_status: optimisticPreviousStatus } as AnyAsset : null);
    } finally {
        setIsUpdatingAdminStatus(false);
    }
  }, [asset, isAdmin]);

  const combinedLoading = isLoading || (isAuthLoading && !dataFetchAttempted);
  const actualIsOwner = !!user && !!asset && asset.user_id === user.id;
  const isMockingOwnerView = 
    isStaging &&
    mockRole === 'owner' && 
    !!user && 
    user.id === MOCK_OWNER_MARKER_USER_ID && 
    !!asset && 
    asset.id === mockOwnerId;
  const finalIsOwner = actualIsOwner || isMockingOwnerView;

  logger.log(`[LoraLoadSpeed] useAssetDetails hook returning. isLoading: ${isLoading}, isAuthLoading: ${isAuthLoading}, dataFetchAttempted: ${dataFetchAttempted}, combinedLoading: ${combinedLoading}, assetId: ${assetId}`);
  if (isStaging && mockRole === 'owner') {
    logger.log(`[useAssetDetails][MockOwnerDebug] 
      Asset ID: ${asset?.id}, 
      Asset User ID: ${asset?.user_id}, 
      Current Auth User ID (from useAuth): ${user?.id}, 
      Target mockOwnerId (from context): ${mockOwnerId}, 
      MOCK_OWNER_MARKER_USER_ID: ${MOCK_OWNER_MARKER_USER_ID}, 
      actualIsOwner: ${actualIsOwner}, 
      isMockingOwnerView: ${isMockingOwnerView}, 
      finalIsOwner: ${finalIsOwner}`);
  }

  return {
    asset,
    videos,
    isLoading: combinedLoading,
    creatorDisplayName: getCreatorName(),
    curatorProfile,
    isLoadingCuratorProfile,
    currentStatus: asset?.user_status ?? null,
    isUpdatingAdminStatus,
    refetchAssetDetails: fetchAssetDetails,
    updateAdminStatus: updateAssetAdminStatus,
    updateUserStatus: updateAssetUserStatus,
    updatePrimaryVideo: updateLocalPrimaryMedia,
    deleteAsset: removeVideoLocally,
    dataFetchAttempted,
    isOwner: finalIsOwner,
    isAdmin, 
  };
};