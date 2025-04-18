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
      console.log('AssetDetailPage - Fetching asset details for ID:', assetId);
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('*, primaryVideo:primary_media_id(*)')
        .eq('id', assetId)
        .maybeSingle();

      if (assetError) {
        console.error('AssetDetailPage - Error fetching asset:', assetError);
        throw assetError;
      }

      if (!assetData) {
        console.error('AssetDetailPage - No asset found with ID:', assetId);
        setIsLoading(false);
        setDataFetchAttempted(true);
        return;
      }

      logger.log('Asset Base Model Verification:', {
        lora_base_model: assetData.lora_base_model,
        type: assetData.type,
        name: assetData.name
      });

      const assetMediaRelationships = await debugAssetMedia(assetId);
      
      if (assetMediaRelationships && Array.isArray(assetMediaRelationships) && assetMediaRelationships.length > 0) {
        const mediaIds = assetMediaRelationships.map(rel => rel.media_id);
        
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .in('id', mediaIds);
          
        if (mediaError) {
          console.error('AssetDetailPage - Error fetching related media:', mediaError);
        } else {
          mediaData.forEach(media => {
            logger.log('Related Media Type:', {
              id: media.id,
              type: media.type,
              title: media.title
            });
          });
        }
      }

      let assetVideos: any[] = [];
      
      if (assetMediaRelationships && Array.isArray(assetMediaRelationships) && assetMediaRelationships.length > 0) {
        const mediaIds = assetMediaRelationships.map(rel => rel.media_id);
        console.log('AssetDetailPage - Fetching media with IDs:', mediaIds);
        
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .in('id', mediaIds);
          
        if (mediaError) {
          console.error('AssetDetailPage - Error fetching related media:', mediaError);
        } else {
          assetVideos = mediaData || [];
          console.log('AssetDetailPage - Related media fetched:', assetVideos.length);
        }
      } else {
        const { data: videoData, error: videoError } = await supabase
          .from('media')
          .select('*')
          .eq('type', 'video');

        if (videoError) {
          console.error('AssetDetailPage - Error fetching videos:', videoError);
          throw videoError;
        }

        console.log('AssetDetailPage - All videos retrieved:', videoData?.length || 0);

        assetVideos = videoData?.filter(video => 
          video.title?.includes(assetData.name) || 
          video.id === assetData.primary_media_id
        ) || [];
        
        console.log('AssetDetailPage - Videos for this asset (filtered by name):', assetVideos?.length || 0);
      }

      const pVideo = assetData.primaryVideo;
      logger.log(`[useAssetDetails] Processing asset: ${assetData.id}, Fetched Primary Video Data (pVideo):`, {
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
          admin_approved: assetData.admin_approved,
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
              admin_approved: pVideo.admin_approved,
              user_id: pVideo.user_id,
              metadata: {
                  title: pVideo.title || assetData.name,
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
        assetVideos.map(async (media: any) => {
          try {
            const videoUrl = await videoUrlService.getVideoUrl(media.url);
            
            return {
              id: media.id,
              url: videoUrl,
              reviewer_name: media.creator || 'Unknown',
              skipped: false,
              created_at: media.created_at,
              admin_approved: media.admin_approved || 'Listed',
              user_id: media.user_id,
              metadata: {
                title: media.title || processedAsset.name,
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
            };
          } catch (error) {
            console.error(`Error processing video ${media.id}:`, error);
            return null;
          }
        })
      );

      setVideos(convertedVideos.filter(v => v !== null) as VideoEntry[]);
      console.log('AssetDetailPage - Final processed related videos:', convertedVideos.filter(v => v !== null).length);
    } catch (error) {
      console.error('Error fetching asset details:', error);
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
        
        console.log('Asset User Profile:', {
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
