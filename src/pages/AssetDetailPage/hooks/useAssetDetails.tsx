import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, VideoEntry, VideoDisplayStatus, VideoMetadata, AdminStatus, UserAssetPreferenceStatus } from '@/lib/types';
import { toast } from 'sonner';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { sortAssetPageVideos } from '@/lib/utils/videoUtils';

const logger = new Logger('useAssetDetails');

// Helper type guard for allowed model strings
const isValidModel = (model: string | undefined): model is VideoMetadata['model'] => {
  if (!model) return false;
  const allowedModels = ['wan', 'hunyuan', 'ltxv', 'cogvideox', 'animatediff'];
  return allowedModels.includes(model.toLowerCase());
};

export const useAssetDetails = (assetId: string | undefined) => {
  const [asset, setAsset] = useState<LoraAsset | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataFetchAttempted, setDataFetchAttempted] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  const [isUpdatingAdminStatus, setIsUpdatingAdminStatus] = useState(false);
  const { user, isAdmin, isLoading: isAuthLoading } = useAuth();

  const initialFetchTriggered = useRef(false);
  const assetRef = useRef<string | undefined>(undefined);

  const fetchAssetDetails = useCallback(async (options?: { silent?: boolean }) => {
    if (!assetId) {
      logger.warn('[useAssetDetails] fetchAssetDetails called without assetId.');
      toast.error('No asset ID provided');
      if (!options?.silent) setIsLoading(false);
      setDataFetchAttempted(true);
      initialFetchTriggered.current = true;
      return;
    }

    logger.log('[useAssetDetails] Starting fetchAssetDetails for ID:', assetId);
    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      logger.log('[useAssetDetails] Fetching core asset details for ID:', assetId);
      
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select(`*, primaryVideo:primary_media_id(*)`)
        .eq('id', assetId)
        .maybeSingle();

      if (assetError) {
        logger.error('[useAssetDetails] Error fetching asset:', assetError);
        throw assetError;
      }

      if (!assetData) {
        logger.warn('[useAssetDetails] No asset found with ID:', assetId);
        setAsset(null);
        setVideos([]);
        return;
      }

      logger.log(`[useAssetDetails] Fetched asset user_status: ${assetData.user_status}`);

      logger.log(`[useAssetDetails] Fetching asset_media joined with media for asset ID: ${assetId}`);
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
        logger.error('[useAssetDetails] Error fetching asset_media joined data:', assetMediaJoinError);
        throw assetMediaJoinError;
      }

      const fetchedAssetMedia = assetMediaJoinData || [];
      logger.log(`[useAssetDetails] Fetched ${fetchedAssetMedia.length} asset_media join records.`);

      const pVideo = assetData.primaryVideo;
      logger.log(`[VideoLightboxDebug] Processing asset: ${assetData.id}, Fetched Primary Video Data (pVideo):`, {
          exists: !!pVideo,
          id: pVideo?.id,
          url: pVideo?.url,
          placeholder: pVideo?.placeholder_image,
          title: pVideo?.title
      });

      const validModel = isValidModel(assetData.lora_base_model) ? assetData.lora_base_model : undefined;

      const processedAsset: LoraAsset = {
          id: assetData.id,
          name: assetData.name,
          description: assetData.description,
          creator: assetData.creator,
          type: assetData.type,
          created_at: assetData.created_at,
          user_id: assetData.user_id,
          primary_media_id: assetData.primary_media_id,
          admin_status: assetData.admin_status,
          user_status: assetData.user_status,
          lora_type: assetData.lora_type,
          lora_base_model: assetData.lora_base_model,
          model_variant: assetData.model_variant,
          lora_link: assetData.lora_link,
          primaryVideo: pVideo ? {
              id: pVideo.id,
              url: pVideo.url,
              reviewer_name: (pVideo as any)?.creator || '',
              skipped: false,
              created_at: pVideo.created_at,
              assetMediaDisplayStatus: (pVideo as any)?.status as VideoDisplayStatus || 'View',
              user_id: pVideo.user_id,
              user_status: (pVideo as any)?.user_status as VideoDisplayStatus || null,
              admin_status: (pVideo as any)?.admin_status as AdminStatus || null,
              metadata: {
                  title: pVideo.title || '',
                  placeholder_image: pVideo.placeholder_image || null,
                  description: pVideo.description,
                  classification: (pVideo as any)?.classification,
                  loraName: assetData.name,
                  assetId: assetData.id,
                  loraType: assetData.lora_type,
                  model: validModel,
                  modelVariant: assetData.model_variant,
              }
          } : undefined
      };
      
      setAsset(processedAsset);

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
 
            const assignedStatus = (item.status as VideoDisplayStatus) || 'View'; 
            logger.log(`[loraorderingbug] Processing Video ${media.id}: Assigned status '${assignedStatus}' (from asset_media.status: ${item.status}, is_primary: ${item.is_primary})`);

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
              metadata: {
                title: media.title || '',
                description: media.description || '',
                placeholder_image: media.placeholder_image || null,
                classification: media.classification,
                model: processedAsset.lora_base_model || media.type,
                loraName: processedAsset.name,
                loraDescription: processedAsset.description,
                assetId: item.asset_id,
                loraType: processedAsset.lora_type,
                loraLink: processedAsset.lora_link,
                modelVariant: processedAsset.model_variant,
                aspectRatio: (media.metadata as any)?.aspectRatio ?? null
              },
              admin_status: media.admin_status as AdminStatus || null,
            };
          } catch (error) {
            logger.error(`[useAssetDetails] Error processing video ${media.id}:`, error);
            return null;
          }
        })
      );

      const validVideos = convertedVideos.filter(v => v !== null) as VideoEntry[];
      logger.log(`[useAssetDetails] Processed ${validVideos.length} valid videos from join data.`);

      const isViewerAuthorized = isAdmin || (!!user && user.id === assetData?.user_id);
      logger.log(`[useAssetDetails] Viewer authorization check: isAdmin=${isAdmin}, user.id=${user?.id}, asset.user_id=${assetData?.user_id}, isAuthorized=${isViewerAuthorized}`);

      const filteredVideos = isViewerAuthorized
        ? validVideos
        : validVideos.filter(v => v.assetMediaDisplayStatus !== 'Hidden');
      logger.log(`[useAssetDetails] Filtered videos count (Hidden removed for non-auth): ${filteredVideos.length}`);

      const sortedVideos = sortAssetPageVideos(filteredVideos, assetData?.primary_media_id);
      logger.log(`[useAssetDetails] Sorted videos count: ${sortedVideos.length}`);

      logger.log('[loraorderingbug] Final sorted video IDs and statuses (before setting state):', sortedVideos.map(v => `${v.id} (Status: ${v.assetMediaDisplayStatus}, Primary: ${v.is_primary})`));

      setVideos(sortedVideos);

    } catch (error) {
      logger.error('[useAssetDetails] Error in fetchAssetDetails:', error);
      toast.error('Failed to load asset details');
      setAsset(null);
      setVideos([]);
    } finally {
      logger.log('[useAssetDetails] fetchAssetDetails finally block executing.');
      if (!options?.silent) {
        setIsLoading(false);
      }
      setDataFetchAttempted(true);
    }
  }, [assetId, user, isAdmin]);

  useEffect(() => {
    logger.log(`[useAssetDetails Effect Trigger] assetId: ${assetId}, isAuthLoading: ${isAuthLoading}, initialFetchTriggered: ${initialFetchTriggered.current}, dataFetchAttempted: ${dataFetchAttempted}`);

    const assetIdChanged = assetId !== assetRef.current;

    if (assetIdChanged) {
        logger.log(`[useAssetDetails Effect Trigger] Asset ID changed from ${assetRef.current} to ${assetId}. Resetting state and fetch trigger.`);
        assetRef.current = assetId;
        setAsset(null);
        setVideos([]);
        setCreatorDisplayName(null);
        setDataFetchAttempted(false);
        initialFetchTriggered.current = false;
        setIsLoading(true);
    }

    if (assetId && !isAuthLoading && !initialFetchTriggered.current) {
      logger.log(`[useAssetDetails Effect Trigger] Conditions met. Calling fetchAssetDetails for ${assetId}.`);
      initialFetchTriggered.current = true;
      fetchAssetDetails();
    } else if (isAuthLoading) {
       logger.log(`[useAssetDetails Effect Trigger] Waiting for auth to load before fetching ${assetId}.`);
       if (!isLoading) setIsLoading(true);
    } else if (!assetId) {
       logger.log(`[useAssetDetails Effect Trigger] No assetId, clearing state and stopping loading.`);
       if (asset) setAsset(null);
       if (videos.length > 0) setVideos([]);
       if (creatorDisplayName) setCreatorDisplayName(null);
       if (isLoading) setIsLoading(false);
       if (dataFetchAttempted) setDataFetchAttempted(false);
       initialFetchTriggered.current = false;
    } else if (assetId && !isAuthLoading && initialFetchTriggered.current) {
       logger.log(`[useAssetDetails Effect Trigger] Auth ready, but fetch already triggered for ${assetId}. Current loading: ${isLoading}, Attempted: ${dataFetchAttempted}`);
       if (isLoading && dataFetchAttempted) {
           logger.log(`[useAssetDetails Effect Trigger] Fetch completed or failed, ensuring loading is false.`);
           setIsLoading(false);
       }
    } else {
        logger.log(`[useAssetDetails Effect Trigger] Unhandled state or condition. assetId=${assetId}, isAuthLoading=${isAuthLoading}, initialFetchTriggered=${initialFetchTriggered.current}`);
    }
  }, [assetId, isAuthLoading, fetchAssetDetails, isLoading, dataFetchAttempted]);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (!asset?.user_id) {
          if (creatorDisplayName !== null) {
              setCreatorDisplayName(null);
          }
          return;
      }

      logger.log(`[useAssetDetails] Fetching profile for creator ID: ${asset.user_id}`);
      try {
          const { data: profile, error } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', asset.user_id)
              .maybeSingle();

          if (error) {
              logger.error(`[useAssetDetails] Error fetching profile for ${asset.user_id}:`, error);
              setCreatorDisplayName(null);
          } else if (profile) {
              setCreatorDisplayName(profile.display_name || profile.username);
          } else {
              setCreatorDisplayName(null);
          }
      } catch (fetchError) {
          logger.error(`[useAssetDetails] Exception during profile fetch for ${asset.user_id}:`, fetchError);
          setCreatorDisplayName(null);
      }
    };

    if (asset?.user_id) {
      fetchCreatorProfile();
    } else {
      if (creatorDisplayName !== null) {
        setCreatorDisplayName(null);
      }
    }
  }, [asset?.user_id]);

  const getCreatorName = () => {
    return creatorDisplayName || asset?.creator || 'Unknown';
  };
  
  const updateAssetUserStatus = useCallback(async (newStatus: UserAssetPreferenceStatus) => {
      // Check authorization using the user/isAdmin state from the hook's scope
      // useCallback dependency ensures these are reasonably fresh
      const isAuthorized = isAdmin || (!!user && user.id === asset?.user_id);

      if (!isAuthorized) {
          logger.warn('[updateAssetUserStatus] Unauthorized attempt.');
          toast.error("You don't have permission.");
          return;
      }
      if (!asset) {
          logger.warn('[updateAssetUserStatus] Asset data not available.');
          return;
      }

      const optimisticPreviousStatus = asset.user_status;
      setAsset(prev => prev ? { ...prev, user_status: newStatus } : null);

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
          setAsset(prev => prev ? { ...prev, user_status: optimisticPreviousStatus } : null);
      }
  }, [asset, user, isAdmin]);

  const updateLocalVideoStatus = useCallback((videoId: string, newStatus: VideoDisplayStatus, type: 'assetMedia' | 'user') => {
    setVideos(prevVideos => {
      const primaryId = asset?.primary_media_id;
      const updatedVideos = prevVideos.map(video => {
        if (video.id === videoId) {
          return {
            ...video,
            assetMediaDisplayStatus: type === 'assetMedia' ? newStatus : video.assetMediaDisplayStatus,
            user_status: type === 'user' ? newStatus : video.user_status
          };
        }
        return video;
      });
      
      const sortedVideos = sortAssetPageVideos(updatedVideos, primaryId);
      
      return sortedVideos;
    });
  }, [asset?.primary_media_id]);

  const updateLocalPrimaryMedia = useCallback((newPrimaryMediaId: string | null) => {
    setAsset(prevAsset => {
      if (!prevAsset || prevAsset.primary_media_id === newPrimaryMediaId) return prevAsset;
      return { ...prevAsset, primary_media_id: newPrimaryMediaId };
    });
    setVideos(prevVideos => {
        const updatedVideos = prevVideos.map(v => ({
            ...v,
            is_primary: v.id === newPrimaryMediaId
        }));
        return sortAssetPageVideos(updatedVideos, newPrimaryMediaId);
    });
    logger.log(`[useAssetDetails] Primary media ID updated locally to ${newPrimaryMediaId}. Videos re-sorted.`);
  }, []);
  
  const removeVideoLocally = useCallback((videoId: string) => {
     setVideos(prevVideos => prevVideos.filter(v => v.id !== videoId));
     logger.log(`[useAssetDetails] Video ${videoId} removed locally.`);
  }, []);

  const updateAssetAdminStatus = useCallback(async (newStatus: AdminStatus) => {
    // Use isAdmin from the hook's scope.
    // useCallback dependency ensures this is reasonably fresh.
    if (!isAdmin) {
        logger.warn('[updateAssetAdminStatus] Non-admin attempt.');
        toast.error("Only admins can change this status.");
        return;
    }
    if (!asset) {
        logger.warn('[updateAssetAdminStatus] Asset data not available.');
        return;
    }

    const optimisticPreviousStatus = asset.admin_status;
    setIsUpdatingAdminStatus(true);
    setAsset(prev => prev ? { ...prev, admin_status: newStatus } : null);

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
        setAsset(prev => prev ? { ...prev, admin_status: optimisticPreviousStatus } : null);
    } finally {
        setIsUpdatingAdminStatus(false);
    }
  }, [asset, isAdmin]);

  const combinedLoading = isLoading || (isAuthLoading && !dataFetchAttempted);

  return {
    asset,
    videos,
    isLoading: combinedLoading,
    isUpdatingAdminStatus,
    dataFetchAttempted,
    creatorDisplayName,
    getCreatorName,
    fetchAssetDetails,
    updateLocalVideoStatus,
    updateLocalPrimaryMedia,
    removeVideoLocally,
    updateAssetUserStatus,
    updateAssetAdminStatus
  };
};
