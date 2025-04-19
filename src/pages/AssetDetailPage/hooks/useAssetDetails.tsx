import { useState, useEffect, useCallback } from 'react';
import { supabase, debugAssetMedia } from '@/integrations/supabase/client';
import { LoraAsset, VideoEntry } from '@/lib/types';
import { toast } from 'sonner';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Logger } from '@/lib/logger';

const logger = new Logger('useAssetDetails');

export const useAssetDetails = (assetId: string | undefined) => {
  const [asset, setAsset] = useState<LoraAsset | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataFetchAttempted, setDataFetchAttempted] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);

  const fetchAssetDetails = useCallback(async () => {
    if (!assetId) {
      toast.error('No asset ID provided');
      setIsLoading(false);
      setDataFetchAttempted(true);
      return;
    }

    try {
      console.log('[VideoLightboxDebug] Fetching asset details for ID:', assetId);
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('*, primaryVideo:primary_media_id(*)')
        .eq('id', assetId)
        .maybeSingle();

      if (assetError) {
        console.error('[VideoLightboxDebug] Error fetching asset:', assetError);
        throw assetError;
      }

      if (!assetData) {
        console.error('[VideoLightboxDebug] No asset found with ID:', assetId);
        setIsLoading(false);
        setDataFetchAttempted(true);
        return;
      }

      logger.log('Asset Base Model Verification:', {
        lora_base_model: assetData.lora_base_model,
        type: assetData.type,
        name: assetData.name
      });

      // Fetch related media by querying asset_media and joining media details
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
        console.error('[VideoLightboxDebug] Error fetching asset_media joined data:', assetMediaJoinError);
        throw assetMediaJoinError;
      }

      const fetchedAssetMedia = assetMediaJoinData || [];
      logger.log(`[useAssetDetails] Fetched ${fetchedAssetMedia.length} asset_media join records.`);
      
      // {ITEMSHOWINGBUG} Log raw fetched asset_media join data
      logger.log('{ITEMSHOWINGBUG} Raw asset_media join data:', fetchedAssetMedia);

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
              assetMediaDisplayStatus: pVideo.admin_status,
              user_id: pVideo.user_id,
              user_status: pVideo.user_status || null,
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
          .filter(item => item.media) // Ensure media data exists from join
          .map(async (item: any) => {
          const media = item.media; // Extract the joined media object
          // {ITEMSHOWINGBUG} Log the item being processed for VideoEntry conversion
          logger.log(`{ITEMSHOWINGBUG} Processing joined item for VideoEntry (media ID: ${media?.id}, asset_media status: ${item.status}):`, item);
          try {
            // Use the joined media URL directly if available
            const videoUrl = media.url ? await videoUrlService.getVideoUrl(media.url) : null; 
            if (!videoUrl) {
              console.warn(`[VideoLightboxDebug] Could not get video URL for media ID: ${media.id}`);
              return null; // Skip if URL is invalid
            }
            
            // Use is_primary directly from asset_media
            const isPrimary = item.is_primary === true; 
 
            // {ITEMSHOWINGBUG} Determine the status to be assigned
            const assignedStatus = item.status || media?.admin_status || 'Listed';
            logger.log(`{ITEMSHOWINGBUG} Assigning status to VideoEntry (media ID: ${media.id}): ${assignedStatus} (Source: item.status=${item.status}, media.admin_status=${media?.admin_status})`);

            return {
              id: media.id,
              url: videoUrl,
              associatedAssetId: assetId,
              is_primary: isPrimary,
              reviewer_name: media.creator || 'Unknown',
              skipped: false,
              created_at: media.created_at,
              assetMediaDisplayStatus: assignedStatus, // Use the determined status with the new field name
              user_id: media.user_id,
              user_status: media.user_status || null,
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
            console.error(`[VideoLightboxDebug] Error processing video ${media.id}:`, error);
            return null;
          }
        })
      );

      const validVideos = convertedVideos.filter(v => v !== null) as VideoEntry[];
      setVideos(validVideos);
      console.log('[VideoLightboxDebug] Final processed related videos:', convertedVideos.filter(v => v !== null).length);
      // {ITEMSHOWINGBUG} Log the final state being set
      logger.log('{ITEMSHOWINGBUG} Final VideoEntry array being set to state:', validVideos);
    } catch (error) {
      console.error('[VideoLightboxDebug] Error fetching asset details:', error);
      toast.error('Failed to load asset details');
    } finally {
      setIsLoading(false);
      setDataFetchAttempted(true);
    }
  }, [assetId]);

  useEffect(() => {
    if (!dataFetchAttempted) {
      fetchAssetDetails();
    }
  }, [fetchAssetDetails, dataFetchAttempted]);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (asset?.user_id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', asset.user_id)
          .maybeSingle();
        
        console.log('[VideoLightboxDebug] Asset User Profile:', {
          user_id: asset.user_id,
          creator: asset.creator,
          profile: profile,
          error: error
        });
        
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
