import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, VideoEntry, VideoDisplayStatus } from '@/lib/types';
import { toast } from 'sonner';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('useAssetDetails');

export const useAssetDetails = (assetId: string | undefined) => {
  const [asset, setAsset] = useState<LoraAsset | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataFetchAttempted, setDataFetchAttempted] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();

  const fetchAssetDetails = useCallback(async () => {
    if (!assetId) {
      toast.error('No asset ID provided');
      setIsLoading(false);
      setDataFetchAttempted(true);
      return;
    }

    setIsLoading(true);
    try {
      logger.log('[useAssetDetails] Fetching asset details for ID:', assetId);
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('*, primaryVideo:primary_media_id(*)')
        .eq('id', assetId)
        .maybeSingle();

      if (assetError) {
        logger.error('[useAssetDetails] Error fetching asset:', assetError);
        throw assetError;
      }

      if (!assetData) {
        logger.error('[useAssetDetails] No asset found with ID:', assetId);
        setAsset(null);
        setVideos([]);
        setIsLoading(false);
        setDataFetchAttempted(true);
        return;
      }

      logger.log('Asset Base Model Verification:', {
        lora_base_model: assetData.lora_base_model,
        type: assetData.type,
        name: assetData.name
      });

      logger.log(`[useAssetDetails] Fetching asset_media joined with media for asset ID: ${assetId}`);
      const { data: assetMediaJoinData, error: assetMediaJoinError } = await supabase
        .from('asset_media')
        .select(`
          status,
          is_primary,
          media:media_id!inner(*)
        `)
        .eq('asset_id', assetId);

      if (assetMediaJoinError) {
        logger.error('[useAssetDetails] Error fetching asset_media joined data:', assetMediaJoinError);
        throw assetMediaJoinError;
      }

      const fetchedAssetMedia = assetMediaJoinData || [];
      logger.log(`[useAssetDetails] Fetched ${fetchedAssetMedia.length} asset_media join records.`);
      logger.log('[loraorderingbug] Raw asset_media join data:', fetchedAssetMedia);

      const pVideo = assetData.primaryVideo;
      logger.log(`[VideoLightboxDebug] Processing asset: ${assetData.id}, Fetched Primary Video Data (pVideo):`, {
          exists: !!pVideo,
          id: pVideo?.id,
          url: pVideo?.url,
          placeholder: pVideo?.placeholder_image,
          title: pVideo?.title
      });

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
          lora_type: assetData.lora_type,
          lora_base_model: assetData.lora_base_model,
          model_variant: assetData.model_variant,
          lora_link: assetData.lora_link,
          primaryVideo: pVideo ? {
              id: pVideo.id,
              url: pVideo.url,
              reviewer_name: pVideo.creator || '',
              skipped: false,
              created_at: pVideo.created_at,
              assetMediaDisplayStatus: (pVideo.status as VideoDisplayStatus) || 'View',
              user_id: pVideo.user_id,
              user_status: (pVideo.user_status as VideoDisplayStatus) || null,
              metadata: {
                  title: pVideo.title || '',
                  placeholder_image: pVideo.placeholder_image || null,
                  description: pVideo.description,
                  creator: pVideo.creator ? 'self' : undefined,
                  creatorName: pVideo.creator_name,
                  classification: pVideo.classification,
                  loraName: assetData.name,
                  assetId: assetData.id,
                  loraType: assetData.lora_type,
                  model: assetData.lora_base_model,
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
          logger.log(`{ITEMSHOWINGBUG} Processing joined item for VideoEntry (media ID: ${media?.id}, asset_media status: ${item.status}, is_primary: ${item.is_primary}):`, item);
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
              associatedAssetId: assetId,
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
                assetId: processedAsset.id,
                loraType: processedAsset.lora_type,
                loraLink: processedAsset.lora_link,
                creator: media.creator ? 'self' : undefined,
                creatorName: media.creator_name,
                modelVariant: processedAsset.model_variant,
              }
            } as VideoEntry;
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

      const statusOrder: { [key in VideoDisplayStatus]: number } = { Pinned: 1, View: 2, Hidden: 3 };
      
      const sortedVideos = filteredVideos.sort((a, b) => {
        // Get statuses with default 'View'
        const statusA = a.assetMediaDisplayStatus || 'View';
        const statusB = b.assetMediaDisplayStatus || 'View';

        // Special case: Primary video should be first unless it's hidden
        if (statusA !== 'Hidden' && statusB !== 'Hidden') {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
        }

        // Then sort by status
        const orderA = statusOrder[statusA] || 2;
        const orderB = statusOrder[statusB] || 2;
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }

        // If same status, sort by date
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      logger.log(`[useAssetDetails] Sorted videos count: ${sortedVideos.length}`);

      logger.log('[loraorderingbug] Final sorted video IDs and statuses (before setting state):', sortedVideos.map(v => `${v.id} (Status: ${v.assetMediaDisplayStatus}, Primary: ${v.is_primary})`));

      setVideos(sortedVideos);
      logger.log('{ITEMSHOWINGBUG} Final VideoEntry array being set to state:', sortedVideos);

    } catch (error) {
      logger.error('[useAssetDetails] Error in fetchAssetDetails:', error);
      toast.error('Failed to load asset details');
      setAsset(null);
      setVideos([]);
    } finally {
      setIsLoading(false);
      setDataFetchAttempted(true);
    }
  }, [assetId, user, isAdmin]);

  useEffect(() => {
    if (!dataFetchAttempted && assetId) {
      fetchAssetDetails();
    }
  }, [fetchAssetDetails, dataFetchAttempted, assetId]);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (asset?.user_id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', asset.user_id)
          .maybeSingle();
        
        logger.log('[useAssetDetails] Asset User Profile fetch result:', { profile, error });
        
        if (profile && !error) {
          setCreatorDisplayName(profile.display_name || profile.username);
        }
      }
    };

    if (asset) {
      fetchCreatorProfile();
    }
  }, [asset]);

  const getCreatorName = () => {
    if (creatorDisplayName) {
      return creatorDisplayName;
    }
    
    if (asset?.creator) {
      if (asset.creator.includes('@')) {
        return asset.creator.split('@')[0];
      }
      return asset.creator;
    }
    
    return 'Unknown';
  };

  return {
    asset,
    videos,
    isLoading,
    dataFetchAttempted,
    creatorDisplayName,
    getCreatorName,
    fetchAssetDetails,
    setAsset,
    setDataFetchAttempted
  };
};
