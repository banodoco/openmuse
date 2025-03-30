
import { useState, useEffect, useCallback } from 'react';
import { supabase, debugAssetMedia } from '@/integrations/supabase/client';
import { LoraAsset, VideoEntry } from '@/lib/types';
import { toast } from 'sonner';
import { videoUrlService } from '@/lib/services/videoUrlService';

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
        .select('*')
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

      console.log('AssetDetailPage - Asset data retrieved:', assetData);

      const assetMediaRelationships = await debugAssetMedia(assetId);
      console.log('AssetDetailPage - Asset media relationships:', assetMediaRelationships);

      let assetVideos: any[] = [];
      
      if (assetMediaRelationships && assetMediaRelationships.length > 0) {
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

      const convertedVideos: VideoEntry[] = await Promise.all(
        assetVideos.map(async (media: any) => {
          try {
            const videoUrl = await videoUrlService.getVideoUrl(media.url);
            
            return {
              id: media.id,
              video_location: videoUrl,
              reviewer_name: media.creator || 'Unknown',
              skipped: false,
              created_at: media.created_at,
              admin_approved: media.admin_approved || 'Listed',
              user_id: media.user_id,
              metadata: {
                title: media.title,
                description: '',
                classification: media.classification,
                model: media.type, // This is the base model (wan, hunyuan, etc)
                loraName: assetData.name,
                loraDescription: assetData.description,
                assetId: assetData.id,
                loraType: assetData.lora_type, // LoRA type (Concept, Motion Style, etc)
                loraLink: assetData.lora_link
              }
            };
          } catch (error) {
            console.error(`Error processing video ${media.id}:`, error);
            return null;
          }
        })
      );

      setAsset(assetData);
      setVideos(convertedVideos.filter(v => v !== null) as VideoEntry[]);
      console.log('AssetDetailPage - Final processed videos:', convertedVideos.filter(v => v !== null).length);
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

  // Creator name helper function
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
