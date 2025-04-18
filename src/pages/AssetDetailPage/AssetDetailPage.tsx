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
    if (!isAdmin) {
      toast.error("You don't have permission to delete this video.");
      return;
    }
    
    // --- Start Deletion Process ---
    try {
      logger.log(`Attempting to delete video and associated files for ID: ${videoId}`);

      // 1. Fetch the media record to get file paths
      const { data: mediaRecord, error: fetchError } = await supabase
        .from('media')
        .select('video_location, metadata')
        .eq('id', videoId)
        .single();

      if (fetchError || !mediaRecord) {
        logger.error(`Failed to fetch media record ${videoId} for deletion:`, fetchError);
        // Decide if we should still try to delete the DB record? For now, let's error out.
        throw new Error(`Could not fetch media record ${videoId} for deletion.`);
      }
      
      const videoPath = mediaRecord.video_location;
      const thumbnailPath = mediaRecord.metadata?.thumbnailUrl; // Access nested property

      // 2. Attempt to delete video file from storage
      if (videoPath) {
        try {
          logger.log(`Attempting to delete video file from storage: ${videoPath}`);
          const { error: storageVideoError } = await supabase.storage
            .from('videos') // Use the 'videos' bucket
            .remove([videoPath]);
          if (storageVideoError) {
            // Log error but don't block DB deletion
            logger.error(`Failed to delete video file '${videoPath}' from storage:`, storageVideoError);
            toast.warning(`Could not delete video file from storage. DB record will still be removed.`);
          } else {
             logger.log(`Successfully deleted video file '${videoPath}' from storage.`);
          }
        } catch (storageError) {
           logger.error(`Error during video file storage deletion for '${videoPath}':`, storageError);
           toast.warning(`Error deleting video file. DB record will still be removed.`);
        }
      } else {
         logger.warn(`No video_location found for media record ${videoId}. Skipping storage deletion.`);
      }
      
      // 3. Attempt to delete thumbnail file from storage
      if (thumbnailPath) {
         try {
            logger.log(`Attempting to delete thumbnail file from storage: ${thumbnailPath}`);
            const { error: storageThumbnailError } = await supabase.storage
              .from('thumbnails') // Use the 'thumbnails' bucket
              .remove([thumbnailPath]);
            if (storageThumbnailError) {
              // Log error but don't block DB deletion
              logger.error(`Failed to delete thumbnail file '${thumbnailPath}' from storage:`, storageThumbnailError);
              toast.warning(`Could not delete thumbnail file from storage. DB record will still be removed.`);
            } else {
               logger.log(`Successfully deleted thumbnail file '${thumbnailPath}' from storage.`);
            }
         } catch (storageError) {
            logger.error(`Error during thumbnail file storage deletion for '${thumbnailPath}':`, storageError);
            toast.warning(`Error deleting thumbnail file. DB record will still be removed.`);
         }
      } else {
          logger.warn(`No metadata.thumbnailUrl found for media record ${videoId}. Skipping thumbnail storage deletion.`);
      }

      // 4. Delete the media record itself from the database
      logger.log(`Attempting to delete media record from database: ${videoId}`);
      const { error: dbError } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);

      if (dbError) {
        // If DB deletion fails, throw error to be caught below
        throw dbError;
      }

      toast.success('Video deleted successfully');
      await fetchAssetDetails(); // Refresh the video list

    } catch (error) {
      logger.error('Error deleting video:', error);
      toast.error(`Failed to delete video: ${error.message || error}`);
      // Optionally re-fetch details even on error?
      // await fetchAssetDetails(); 
    }
  };

  // New function to delete the entire asset
  const handleDeleteAsset = async () => {
    if (!isAuthorized) {
        toast.error("You don't have permission to delete this asset.");
        return;
    }
    if (!asset) {
      toast.error("Asset data not available.");
      return;
    }

    const assetId = asset.id;
    logger.log(`Attempting to delete asset ${assetId} and associated data.`);

    try {
      // 1. Fetch associated media records to get file paths
      const { data: associatedMedia, error: fetchMediaError } = await supabase
        .from('media')
        .select('id, video_location, metadata')
        .eq('asset_id', assetId); // Assuming 'asset_id' column links media to assets

      if (fetchMediaError) {
        logger.error(`Failed to fetch associated media for asset ${assetId}:`, fetchMediaError);
        throw new Error(`Could not fetch associated media for asset ${assetId}. Deletion aborted.`);
      }

      logger.log(`Found ${associatedMedia?.length || 0} associated media records for asset ${assetId}.`);

      if (associatedMedia && associatedMedia.length > 0) {
        const videoPaths: string[] = [];
        const thumbnailPaths: string[] = [];
        const mediaIds: string[] = associatedMedia.map(media => {
            if (media.video_location) videoPaths.push(media.video_location);
            if (media.metadata?.thumbnailUrl) thumbnailPaths.push(media.metadata.thumbnailUrl);
            return media.id;
        });

        // 2. Attempt to delete associated video files from storage
        if (videoPaths.length > 0) {
          logger.log(`Attempting to delete ${videoPaths.length} video files from storage bucket 'videos'.`);
          const { data: deletedVideos, error: storageVideoError } = await supabase.storage
            .from('videos')
            .remove(videoPaths);
          
          if (storageVideoError) {
            logger.error('Error deleting video files from storage:', storageVideoError);
            toast.warning('Some video files could not be deleted from storage. Associated DB records will still be removed.');
          } else {
            logger.log(`Successfully deleted ${deletedVideos?.length || 0} video files.`);
          }
        }
        
        // 3. Attempt to delete associated thumbnail files from storage
        if (thumbnailPaths.length > 0) {
           logger.log(`Attempting to delete ${thumbnailPaths.length} thumbnail files from storage bucket 'thumbnails'.`);
           const { data: deletedThumbnails, error: storageThumbnailError } = await supabase.storage
             .from('thumbnails')
             .remove(thumbnailPaths);
           
           if (storageThumbnailError) {
             logger.error('Error deleting thumbnail files from storage:', storageThumbnailError);
             toast.warning('Some thumbnail files could not be deleted from storage. Associated DB records will still be removed.');
           } else {
             logger.log(`Successfully deleted ${deletedThumbnails?.length || 0} thumbnail files.`);
           }
         }

        // 4. Delete associated media records from the database
        if (mediaIds.length > 0) {
          logger.log(`Attempting to delete ${mediaIds.length} associated media records from database.`);
          const { error: mediaDbError } = await supabase
            .from('media')
            .delete()
            .in('id', mediaIds); // Use .in() for multiple IDs

          if (mediaDbError) {
            logger.error('Error deleting associated media records from database:', mediaDbError);
            // If deleting media records fails, we should probably stop before deleting the asset
            throw new Error(`Failed to delete associated media records: ${mediaDbError.message}`);
          }
           logger.log('Successfully deleted associated media records.');
        }
      }

      // 5. Delete the asset record itself
      logger.log(`Attempting to delete asset record ${assetId} from database.`);
      const { error: assetDbError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);

      if (assetDbError) {
        // If asset deletion fails
        throw assetDbError;
      }

      toast.success('LoRA Asset and associated data deleted successfully');
      navigate('/'); // Navigate away after successful deletion

    } catch (error) {
      logger.error(`Error during asset deletion process for ${assetId}:`, error);
      toast.error(`Failed to delete asset: ${error.message || error}`);
      // Consider if UI state needs resetting or refetching on failure
    }
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
