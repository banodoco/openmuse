import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LoraAsset, VideoEntry } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import AssetHeader from './components/AssetHeader';
import AssetInfoCard from './components/AssetInfoCard';
import AssetVideoSection from './components/AssetVideoSection';
import { useAssetDetails } from './hooks/useAssetDetails';
import { useAssetAdminActions } from './hooks/useAssetAdminActions';
import { useAuth } from '@/hooks/useAuth';
import VideoLightbox from '@/components/VideoLightbox';
import { toast } from 'sonner';

const logger = new Logger('AssetDetailPage');

function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoEntry | null>(null);
  
  const {
    asset,
    videos,
    isLoading,
    creatorDisplayName,
    getCreatorName,
    fetchAssetDetails,
    setAsset
  } = useAssetDetails(id);
  
  // Calculate if the current user is authorized to edit or delete the asset
  const isAuthorized = isAdmin || (!!user && user.id === asset?.user_id);
  
  const {
    isApproving,
    handleCurateAsset,
    handleListAsset,
    handleRejectAsset,
  } = useAssetAdminActions(id, setAsset, fetchAssetDetails);
  
  const handleOpenLightbox = (video: VideoEntry) => {
    setCurrentVideo(video);
    setLightboxOpen(true);
  };
  
  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setCurrentVideo(null);
  };
  
  const handleApproveVideo = async (videoId: string) => {
    try {
      logger.log(`Approving video: ${videoId}`);
      const { error } = await supabase
        .from('media')
        .update({ admin_approved: 'Curated' })
        .eq('id', videoId);
        
      if (error) throw error;
      toast.success('Video approved');
      await fetchAssetDetails();
    } catch (error) {
      logger.error('Error approving video:', error);
      toast.error('Failed to approve video');
    }
  };
  
  // Renamed from handleDeleteVideo, keeps existing reject logic
  const handleRejectVideo = async (videoId: string) => {
    try {
      logger.log(`Rejecting video: ${videoId}`);
      const { error } = await supabase
        .from('media')
        .update({ admin_approved: 'Rejected' })
        .eq('id', videoId);
        
      if (error) throw error;
      toast.success('Video rejected');
      await fetchAssetDetails();
    } catch (error) {
      logger.error('Error rejecting video:', error);
      toast.error('Failed to reject video');
    }
  };

  // New function to actually delete a video
  const handleDeleteVideo = async (videoId: string) => {
    logger.log(`[handleDeleteVideo] Initiated for video ID: ${videoId}`);
    if (!isAdmin) {
      logger.warn(`[handleDeleteVideo] Permission denied: User is not admin. Video ID: ${videoId}`);
      toast.error("You don't have permission to delete this video.");
      return;
    }
    
    logger.log(`[handleDeleteVideo] User authorized as admin. Proceeding with deletion for video ID: ${videoId}`);
    // --- Start Deletion Process ---
    try {
      logger.log(`[handleDeleteVideo] Attempting to fetch media record for ID: ${videoId}`);
      // 1. Fetch the media record to get file paths
      const { data: mediaRecord, error: fetchError } = await supabase
        .from('media')
        .select('video_location, metadata')
        .eq('id', videoId)
        .single();

      if (fetchError || !mediaRecord) {
        logger.error(`[handleDeleteVideo] Failed to fetch media record ${videoId}:`, fetchError);
        throw new Error(`Could not fetch media record ${videoId}.`);
      }
      logger.log(`[handleDeleteVideo] Successfully fetched media record for ID: ${videoId}`, mediaRecord);
      
      const videoPath = mediaRecord.video_location;
      const thumbnailPath = mediaRecord.metadata?.thumbnailUrl;
      logger.log(`[handleDeleteVideo] Video path: ${videoPath || 'N/A'}, Thumbnail path: ${thumbnailPath || 'N/A'} for ID: ${videoId}`);

      // 2. Attempt to delete video file from storage
      if (videoPath) {
        logger.log(`[handleDeleteVideo] Attempting to delete video file from 'videos' bucket: ${videoPath}`);
        try {
          const { data: deleteData, error: storageVideoError } = await supabase.storage
            .from('videos')
            .remove([videoPath]);
          if (storageVideoError) {
            logger.warn(`[handleDeleteVideo] Failed to delete video file '${videoPath}' from storage (non-blocking):`, storageVideoError);
            toast.warning(`Could not delete video file from storage.`);
          } else {
             logger.log(`[handleDeleteVideo] Successfully deleted video file '${videoPath}' from storage.`, deleteData);
          }
        } catch (storageError) {
           logger.warn(`[handleDeleteVideo] Exception during video file storage deletion for '${videoPath}' (non-blocking):`, storageError);
           toast.warning(`Error occurred during video file deletion.`);
        }
      } else {
         logger.log(`[handleDeleteVideo] No video_location found for media record ${videoId}. Skipping video storage deletion.`);
      }
      
      // 3. Attempt to delete thumbnail file from storage
      if (thumbnailPath) {
        logger.log(`[handleDeleteVideo] Attempting to delete thumbnail file from 'thumbnails' bucket: ${thumbnailPath}`);
         try {
            const { data: deleteData, error: storageThumbnailError } = await supabase.storage
              .from('thumbnails')
              .remove([thumbnailPath]);
            if (storageThumbnailError) {
              logger.warn(`[handleDeleteVideo] Failed to delete thumbnail file '${thumbnailPath}' from storage (non-blocking):`, storageThumbnailError);
              toast.warning(`Could not delete thumbnail file from storage.`);
            } else {
               logger.log(`[handleDeleteVideo] Successfully deleted thumbnail file '${thumbnailPath}' from storage.`, deleteData);
            }
         } catch (storageError) {
            logger.warn(`[handleDeleteVideo] Exception during thumbnail file storage deletion for '${thumbnailPath}' (non-blocking):`, storageError);
            toast.warning(`Error occurred during thumbnail file deletion.`);
         }
      } else {
          logger.log(`[handleDeleteVideo] No metadata.thumbnailUrl found for media record ${videoId}. Skipping thumbnail storage deletion.`);
      }

      // 4. Delete the media record itself from the database
      logger.log(`[handleDeleteVideo] Attempting to delete media record from database for ID: ${videoId}`);
      const { error: dbError } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);

      if (dbError) {
        logger.error(`[handleDeleteVideo] Failed to delete media record ${videoId} from database:`, dbError);
        throw dbError; // Throw error to be caught by the outer catch block
      }
      logger.log(`[handleDeleteVideo] Successfully deleted media record from database for ID: ${videoId}`);

      toast.success('Video deleted successfully');
      logger.log(`[handleDeleteVideo] Deletion successful for ID: ${videoId}. Refreshing asset details.`);
      await fetchAssetDetails();

    } catch (error) {
      logger.error(`[handleDeleteVideo] Error during deletion process for video ID ${videoId}:`, error);
      toast.error(`Failed to delete video: ${error.message || 'Unknown error'}`);
    }
    logger.log(`[handleDeleteVideo] Finished for video ID: ${videoId}`);
  };

  // New function to delete the entire asset
  const handleDeleteAsset = async () => {
    logger.log(`[handleDeleteAsset] Initiated.`);
    if (!isAuthorized) {
        logger.warn(`[handleDeleteAsset] Permission denied: User is not owner or admin.`);
        toast.error("You don't have permission to delete this asset.");
        return;
    }
    if (!asset) {
      logger.warn(`[handleDeleteAsset] Aborted: Asset data not available.`);
      toast.error("Asset data not available.");
      return;
    }

    const assetId = asset.id;
    logger.log(`[handleDeleteAsset] User authorized. Proceeding with deletion for asset ID: ${assetId}`);

    try {
      // 1. Fetch associated media records
      logger.log(`[handleDeleteAsset] Fetching associated media for asset ID: ${assetId}`);
      const { data: associatedMedia, error: fetchMediaError } = await supabase
        .from('media')
        .select('id, video_location, metadata')
        .eq('asset_id', assetId);

      if (fetchMediaError) {
        logger.error(`[handleDeleteAsset] Failed to fetch associated media for asset ${assetId}:`, fetchMediaError);
        throw new Error(`Could not fetch associated media for asset ${assetId}.`);
      }

      logger.log(`[handleDeleteAsset] Found ${associatedMedia?.length || 0} associated media records for asset ${assetId}.`);

      if (associatedMedia && associatedMedia.length > 0) {
        const videoPaths: string[] = [];
        const thumbnailPaths: string[] = [];
        const mediaIds: string[] = associatedMedia.map(media => {
            const videoPath = media.video_location;
            const thumbPath = media.metadata?.thumbnailUrl;
            if (videoPath) videoPaths.push(videoPath);
            if (thumbPath) thumbnailPaths.push(thumbPath);
            return media.id;
        });
        logger.log(`[handleDeleteAsset] Media IDs to delete: [${mediaIds.join(', ')}]`);
        logger.log(`[handleDeleteAsset] Video paths to delete: [${videoPaths.join(', ')}]`);
        logger.log(`[handleDeleteAsset] Thumbnail paths to delete: [${thumbnailPaths.join(', ')}]`);

        // 2. Attempt to delete associated video files from storage
        if (videoPaths.length > 0) {
          logger.log(`[handleDeleteAsset] Attempting to delete ${videoPaths.length} video files from 'videos' bucket.`);
          try {
            const { data: deletedVideos, error: storageVideoError } = await supabase.storage
              .from('videos')
              .remove(videoPaths);
            
            if (storageVideoError) {
              logger.warn('[handleDeleteAsset] Error deleting video files from storage (non-blocking):', storageVideoError);
              toast.warning('Some video files could not be deleted from storage.');
            } else {
              logger.log(`[handleDeleteAsset] Successfully deleted ${deletedVideos?.length || 0} video files from storage.`);
            }
          } catch (storageError) {
              logger.warn('[handleDeleteAsset] Exception during bulk video file storage deletion (non-blocking):', storageError);
              toast.warning('Error occurred during video file deletion.');
          }
        }
        
        // 3. Attempt to delete associated thumbnail files from storage
        if (thumbnailPaths.length > 0) {
           logger.log(`[handleDeleteAsset] Attempting to delete ${thumbnailPaths.length} thumbnail files from 'thumbnails' bucket.`);
           try {
             const { data: deletedThumbnails, error: storageThumbnailError } = await supabase.storage
               .from('thumbnails')
               .remove(thumbnailPaths);
             
             if (storageThumbnailError) {
               logger.warn('[handleDeleteAsset] Error deleting thumbnail files from storage (non-blocking):', storageThumbnailError);
               toast.warning('Some thumbnail files could not be deleted from storage.');
             } else {
               logger.log(`[handleDeleteAsset] Successfully deleted ${deletedThumbnails?.length || 0} thumbnail files from storage.`);
             }
           } catch (storageError) {
              logger.warn('[handleDeleteAsset] Exception during bulk thumbnail file storage deletion (non-blocking):', storageError);
              toast.warning('Error occurred during thumbnail file deletion.');
           }
         }

        // 4. Delete associated media records from the database
        if (mediaIds.length > 0) {
          logger.log(`[handleDeleteAsset] Attempting to delete ${mediaIds.length} associated media records from database.`);
          const { error: mediaDbError } = await supabase
            .from('media')
            .delete()
            .in('id', mediaIds);

          if (mediaDbError) {
            logger.error('[handleDeleteAsset] Error deleting associated media records from database:', mediaDbError);
            throw new Error(`Failed to delete associated media records: ${mediaDbError.message}`);
          }
           logger.log('[handleDeleteAsset] Successfully deleted associated media records from database.');
        }
      }

      // 5. Delete the asset record itself
      logger.log(`[handleDeleteAsset] Attempting to delete asset record ${assetId} from database.`);
      const { error: assetDbError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);

      if (assetDbError) {
        logger.error(`[handleDeleteAsset] Failed to delete asset record ${assetId} from database:`, assetDbError);
        throw assetDbError;
      }
      logger.log(`[handleDeleteAsset] Successfully deleted asset record ${assetId} from database.`);

      toast.success('LoRA Asset and associated data deleted successfully');
      logger.log(`[handleDeleteAsset] Deletion successful for asset ID: ${assetId}. Navigating away.`);
      navigate('/');

    } catch (error) {
      logger.error(`[handleDeleteAsset] Error during deletion process for asset ID ${assetId}:`, error);
      toast.error(`Failed to delete asset: ${error.message || 'Unknown error'}`);
    }
    logger.log(`[handleDeleteAsset] Finished for asset ID: ${assetId}`);
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navigation />
        <div className="flex-1 w-full max-w-6xl mx-auto p-4">
          <div className="flex justify-center items-center h-64">
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <div className="flex-1 w-full max-w-screen-2xl mx-auto p-4">
        {asset && (
          <>
            <AssetHeader asset={asset} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="lg:col-span-1">
                <AssetInfoCard 
                  asset={asset}
                  isAuthorizedToEdit={isAuthorized}
                  isAdmin={isAdmin}
                  isApproving={isApproving}
                  handleCurateAsset={handleCurateAsset}
                  handleListAsset={handleListAsset}
                  handleRejectAsset={handleRejectAsset}
                  handleDeleteAsset={handleDeleteAsset}
                  getCreatorName={getCreatorName}
                />
              </div>
              
              <div className="lg:col-span-2">
                <AssetVideoSection 
                  asset={asset}
                  videos={videos}
                  isAdmin={isAdmin}
                  handleOpenLightbox={handleOpenLightbox}
                  handleApproveVideo={handleApproveVideo}
                  handleDeleteVideo={handleDeleteVideo}
                  handleRejectVideo={handleRejectVideo}
                  fetchAssetDetails={fetchAssetDetails}
                />
              </div>
            </div>
          </>
        )}
      </div>
      
      {currentVideo && (
        <VideoLightbox
          isOpen={lightboxOpen}
          onClose={handleCloseLightbox}
          videoUrl={currentVideo.video_location}
          title={currentVideo.metadata?.title}
          creator={currentVideo.user_id || currentVideo.metadata?.creatorName}
          thumbnailUrl={currentVideo.metadata?.thumbnailUrl}
          creatorId={currentVideo.user_id}
        />
      )}
      
      <Footer />
    </div>
  );
}

export default AssetDetailPage;
