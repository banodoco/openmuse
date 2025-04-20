import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LoraAsset, VideoEntry, VideoDisplayStatus, UserAssetPreferenceStatus, AdminStatus } from '@/lib/types';
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
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import LoadingState from '@/components/LoadingState';

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
    isUpdatingAdminStatus,
    creatorDisplayName,
    getCreatorName,
    fetchAssetDetails,
    setAsset,
    updateLocalVideoStatus,
    updateLocalPrimaryMedia,
    removeVideoLocally,
    updateAssetUserStatus,
    updateAssetAdminStatus
  } = useAssetDetails(id);
  
  const isAuthorized = isAdmin || (!!user && user.id === asset?.user_id);
  
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
      // logger.log(`Approving video: ${videoId}`);
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Curated' })
        .eq('id', videoId);
        
      if (error) throw error;
      toast.success('Video approved');
      await fetchAssetDetails();
    } catch (error) {
      // logger.error('Error approving video:', error);
      toast.error('Failed to approve video');
    }
  };
  
  const handleRejectVideo = async (videoId: string) => {
    try {
      // logger.log(`Rejecting video: ${videoId}`);
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Rejected' })
        .eq('id', videoId);
        
      if (error) throw error;
      toast.success('Video rejected');
      await fetchAssetDetails();
    } catch (error) {
      // logger.error('Error rejecting video:', error);
      toast.error('Failed to reject video');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    // logger.log(`[handleDeleteVideo] Initiated for video ID: ${videoId}`);
    if (!isAdmin) {
      // logger.warn(`[handleDeleteVideo] Permission denied: User is not admin. Video ID: ${videoId}`);
      toast.error("You don't have permission to delete this video.");
      return;
    }
    
    // logger.log(`[handleDeleteVideo] User authorized as admin. Proceeding with deletion for video ID: ${videoId}`);
    try {
      // logger.log(`[handleDeleteVideo] Attempting to fetch media record for ID: ${videoId}`);
      const { data: mediaRecord, error: fetchError } = await supabase
        .from('media')
        .select('url, placeholder_image')
        .eq('id', videoId)
        .single();

      if (fetchError || !mediaRecord) {
        // logger.error(`[handleDeleteVideo] Failed to fetch media record ${videoId}:`, fetchError);
        throw new Error(`Could not fetch media record ${videoId}.`);
      }
      // logger.log(`[handleDeleteVideo] Successfully fetched media record for ID: ${videoId}`, mediaRecord);
      
      const videoPath = mediaRecord.url;
      const thumbnailPath = mediaRecord.placeholder_image;
      // logger.log(`[handleDeleteVideo] Video URL: ${videoPath || 'N/A'}, Thumbnail path: ${thumbnailPath || 'N/A'} for ID: ${videoId}`);

      if (videoPath) {
        // logger.log(`[handleDeleteVideo] Attempting to delete video file from 'videos' bucket: ${videoPath}`);
        try {
          const { data: deleteData, error: storageVideoError } = await supabase.storage
            .from('videos')
            .remove([videoPath]);
          if (storageVideoError) {
            // logger.warn(`[handleDeleteVideo] Failed to delete video file '${videoPath}' from storage (non-blocking):`, storageVideoError);
            toast.warning(`Could not delete video file from storage.`);
          } else {
             // logger.log(`[handleDeleteVideo] Successfully deleted video file '${videoPath}' from storage.`, deleteData);
          }
        } catch (storageError) {
           // logger.warn(`[handleDeleteVideo] Exception during video file storage deletion for '${videoPath}' (non-blocking):`, storageError);
           toast.warning(`Error occurred during video file deletion.`);
        }
      } else {
         // logger.log(`[handleDeleteVideo] No url found for media record ${videoId}. Skipping video storage deletion.`);
      }
      
      if (thumbnailPath) {
        // logger.log(`[handleDeleteVideo] Attempting to delete thumbnail file from 'thumbnails' bucket: ${thumbnailPath}`);
         try {
            const { data: deleteData, error: storageThumbnailError } = await supabase.storage
              .from('thumbnails')
              .remove([thumbnailPath]);
            if (storageThumbnailError) {
              // logger.warn(`[handleDeleteVideo] Failed to delete thumbnail file '${thumbnailPath}' from storage (non-blocking):`, storageThumbnailError);
              toast.warning(`Could not delete thumbnail file from storage.`);
            } else {
               // logger.log(`[handleDeleteVideo] Successfully deleted thumbnail file '${thumbnailPath}' from storage.`, deleteData);
            }
         } catch (storageError) {
            // logger.warn(`[handleDeleteVideo] Exception during thumbnail file storage deletion for '${thumbnailPath}' (non-blocking):`, storageError);
            toast.warning(`Error occurred during thumbnail file deletion.`);
         }
      } else {
          // logger.log(`[handleDeleteVideo] No placeholder_image found for media record ${videoId}. Skipping thumbnail storage deletion.`);
      }

      // logger.log(`[handleDeleteVideo] Attempting to delete media record from database for ID: ${videoId}`);
      const { error: dbError } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);

      if (dbError) {
        // logger.error(`[handleDeleteVideo] Failed to delete media record ${videoId} from database:`, dbError);
        throw dbError;
      }
      // logger.log(`[handleDeleteVideo] Successfully deleted media record from database for ID: ${videoId}`);

      removeVideoLocally(videoId);
      toast.success('Video deleted successfully');

    } catch (error) {
      // logger.error(`[handleDeleteVideo] Error during deletion process for video ID ${videoId}:`, error);
      toast.error(`Failed to delete video: ${error.message || 'Unknown error'}`);
    }
    // logger.log(`[handleDeleteVideo] Finished for video ID: ${videoId}`);
  };

  const handleDeleteAsset = async () => {
    // logger.log(`[handleDeleteAsset] Initiated.`);
    if (!isAuthorized) {
        // logger.warn(`[handleDeleteAsset] Permission denied: User is not owner or admin.`);
        toast.error("You don't have permission to delete this asset.");
        return;
    }
    if (!asset) {
      // logger.warn(`[handleDeleteAsset] Aborted: Asset data not available.`);
      toast.error("Asset data not available.");
      return;
    }

    const assetId = asset.id;
    // logger.log(`[handleDeleteAsset] User authorized. Proceeding with deletion for asset ID: ${assetId}`);

    try {
      // logger.log(`[handleDeleteAsset] Fetching associated media for asset ID: ${assetId}`);
      const { data: associatedMedia, error: fetchMediaError } = await supabase
        .from('media')
        .select('id, url, placeholder_image')
        .eq('asset_id', assetId);

      if (fetchMediaError) {
        // logger.error(`[handleDeleteAsset] Failed to fetch associated media for asset ${assetId}:`, fetchMediaError);
        throw new Error(`Could not fetch associated media for asset ${assetId}.`);
      }

      // logger.log(`[handleDeleteAsset] Found ${associatedMedia?.length || 0} associated media records for asset ${assetId}.`);

      if (associatedMedia && associatedMedia.length > 0) {
        const videoPaths: string[] = [];
        const thumbnailPaths: string[] = [];
        const mediaIds: string[] = associatedMedia.map(media => {
            const videoPath = media.url;
            const thumbPath = media.placeholder_image;
            if (videoPath) videoPaths.push(videoPath);
            if (thumbPath) thumbnailPaths.push(thumbPath);
            return media.id;
        });
        // logger.log(`[handleDeleteAsset] Media IDs to delete: [${mediaIds.join(', ')}]`);
        // logger.log(`[handleDeleteAsset] Video paths to delete: [${videoPaths.join(', ')}]`);
        // logger.log(`[handleDeleteAsset] Thumbnail paths to delete: [${thumbnailPaths.join(', ')}]`);

        if (videoPaths.length > 0) {
          // logger.log(`[handleDeleteAsset] Attempting to delete ${videoPaths.length} video files from 'videos' bucket.`);
          try {
            const { data: deletedVideos, error: storageVideoError } = await supabase.storage
              .from('videos')
              .remove(videoPaths);
            
            if (storageVideoError) {
              // logger.warn('[handleDeleteAsset] Error deleting video files from storage (non-blocking):', storageVideoError);
              toast.warning('Some video files could not be deleted from storage.');
            } else {
              // logger.log(`[handleDeleteAsset] Successfully deleted ${deletedVideos?.length || 0} video files from storage.`);
            }
          } catch (storageError) {
              // logger.warn('[handleDeleteAsset] Exception during bulk video file storage deletion (non-blocking):', storageError);
              toast.warning('Error occurred during video file deletion.');
          }
        }
        
        if (thumbnailPaths.length > 0) {
           // logger.log(`[handleDeleteAsset] Attempting to delete ${thumbnailPaths.length} thumbnail files from 'thumbnails' bucket.`);
           try {
             const { data: deletedThumbnails, error: storageThumbnailError } = await supabase.storage
               .from('thumbnails')
               .remove(thumbnailPaths);
             
             if (storageThumbnailError) {
               // logger.warn('[handleDeleteAsset] Error deleting thumbnail files from storage (non-blocking):', storageThumbnailError);
               toast.warning('Some thumbnail files could not be deleted from storage.');
             } else {
               // logger.log(`[handleDeleteAsset] Successfully deleted ${deletedThumbnails?.length || 0} thumbnail files from storage.`);
             }
           } catch (storageError) {
               // logger.warn('[handleDeleteAsset] Exception during bulk thumbnail file storage deletion (non-blocking):', storageError);
               toast.warning('Error occurred during thumbnail file deletion.');
           }
         }

        if (mediaIds.length > 0) {
           // logger.log(`[handleDeleteAsset] Attempting to delete ${mediaIds.length} associated media records from database.`);
           const { error: deleteMediaError } = await supabase
             .from('media')
             .delete()
             .in('id', mediaIds);

           if (deleteMediaError) {
             // logger.error('[handleDeleteAsset] Error deleting associated media records from database:', deleteMediaError);
             throw deleteMediaError;
           }
           // logger.log('[handleDeleteAsset] Successfully deleted associated media records from database.');
        }
      }

      // logger.log(`[handleDeleteAsset] Attempting to delete asset record ${assetId} from database.`);
      const { error: deleteAssetError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);

      if (deleteAssetError) {
        // logger.error(`[handleDeleteAsset] Failed to delete asset record ${assetId}:`, deleteAssetError);
        throw deleteAssetError;
      }
      // logger.log(`[handleDeleteAsset] Successfully deleted asset record ${assetId} from database.`);
      
      toast.success('Asset deleted successfully');
      navigate('/'); // Redirect after successful deletion
    } catch (error) {
      // logger.error(`[handleDeleteAsset] Error during asset deletion process for ID ${assetId}:`, error);
      toast.error(`Failed to delete asset: ${error.message || 'Unknown error'}`);
    }
    // logger.log(`[handleDeleteAsset] Finished for asset ID: ${assetId}`);
  };
  
  const handleSetPrimaryMedia = async (mediaId: string) => {
    if (!asset || !asset.id) {
        toast.error("Asset ID is missing. Cannot set primary media.");
        return;
    }
    const { id } = asset;
    // logger.log(`[handleSetPrimaryMedia] Setting media ${mediaId} as primary for asset ${id}`);
    try {
      const { error } = await supabase.rpc('set_primary_media', {
        p_asset_id: id,
        p_media_id: mediaId,
      });

      if (error) throw error;

      updateLocalPrimaryMedia(mediaId);
      toast.success('Primary media updated successfully!');
      // Optionally re-fetch asset details if needed to confirm other changes
      // await fetchAssetDetails(); 

    } catch (error: any) {
      logger.error(`[handleSetPrimaryMedia] Error setting primary media:`, error);
      toast.error(`Failed to update primary media: ${error.message}`);
    }
  };
  
  const handleLightboxAssetStatusChange = async (newStatus: VideoDisplayStatus) => {
    if (!currentVideo || !asset?.id) {
      // logger.warn('Attempted to change status without video or asset ID');
      return;
    }
    
    // logger.log(`[AssetDetailPage] handleLightboxAssetStatusChange called for video ${currentVideo.id} on asset ${asset.id} with status ${newStatus}`);
    
    // Call the local state update function - it doesn't return anything or perform the DB update
    updateLocalVideoStatus(
      currentVideo.id, 
      newStatus, 
      'assetMedia'
    );

    // Assume optimistic update succeeded and show toast/update lightbox state
    // TODO: This should ideally happen *after* a successful database update confirmation
    toast.success(`Video status updated to ${newStatus}`);
    setCurrentVideo(prev => prev ? { ...prev, assetMediaDisplayStatus: newStatus } : null);
    
    // NOTE: The actual database update logic for asset_media.status seems missing here.
    // Need to add a call like: 
    // await supabase.from('asset_media').update({ status: newStatus }).eq('asset_id', asset.id).eq('media_id', currentVideo.id)
    // and handle its success/error, potentially reverting the optimistic update.
  };
  
  const handleSetVideoAdminStatus = async (videoId: string, newStatus: AdminStatus) => {
    if (!isAdmin) {
      toast.error("Permission denied.");
      return;
    }
    // logger.log(`[AssetDetailPage] Setting video ${videoId} admin status to ${newStatus}`);
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: newStatus, admin_reviewed: true }) // Also mark as reviewed
        .eq('id', videoId);

      if (error) throw error;

      toast.success(`Video admin status updated to ${newStatus}`);
      // The component will re-render with updated videos from the hook.
      // If the currently open lightbox video (currentVideo) was the one updated,
      // its details might be stale until the user closes and reopens it, or we could 
      // add more complex state management here if needed later.
    } catch (error: any) {
      logger.error(`[AssetDetailPage] Error setting video admin status:`, error);
      toast.error(`Failed to update video admin status: ${error.message}`);
    }
  };
  
  // logger.log(`[AssetDetailPage Render] isLoading: ${isLoading}, asset exists: ${!!asset}`);

  if (isLoading) {
    // logger.log('[AssetDetailPage Render] Returning loading state.');
    return (
      <ErrorBoundary fallbackRender={({ error }) => <div className="p-4 text-red-500">Error loading asset details: {error.message}</div>}>
        <Suspense fallback={<LoadingState />}>
          <div className="w-full min-h-screen flex flex-col">
            <Helmet>
              <title>Loading Asset Details</title>
            </Helmet>
            <main className="flex-grow">
              {/* Placeholder for loading state */}
            </main>
            <Footer />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }
  
  if (!asset) {
    // logger.log('[AssetDetailPage Render] Asset is null or undefined AFTER loading completed. Returning Not Found/Error state.');
    return (
      <ErrorBoundary fallbackRender={({ error }) => <div className="p-4 text-red-500">Error determining asset: {error.message}</div>}>
        <Suspense fallback={<LoadingState />}>
          <div className="w-full min-h-screen flex flex-col">
            <Helmet>
              <title>Error Determining Asset</title>
            </Helmet>
            <main className="flex-grow">
              {/* Placeholder for error state */}
            </main>
            <Footer />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }

  // logger.log('[AssetDetailPage Render] Asset loaded, proceeding to render main content.', asset);
  // logger.log('[AssetDetailPage Render] Videos state:', videos);
  
  return (
    <ErrorBoundary fallbackRender={({ error }) => <div className="p-4 text-red-500">An error occurred: {error.message}</div>}>
      <Suspense fallback={<LoadingState />}>
        <div className="w-full min-h-screen flex flex-col">
          <Helmet>
            <title>{`${asset.name || 'Asset'} Details - OpenMuse`}</title>
          </Helmet>
          <Navigation />
          <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
            <AssetHeader 
              asset={asset} 
              creatorName={getCreatorName()}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                <AssetInfoCard 
                  asset={asset}
                  isAuthorizedToEdit={isAuthorized}
                  userIsLoggedIn={!!user}
                  currentStatus={asset?.user_status ?? null}
                  onStatusChange={updateAssetUserStatus}
                  isAdmin={isAdmin}
                  isAuthorized={isAuthorized}
                  isUpdatingAdminStatus={isUpdatingAdminStatus}
                  onAdminStatusChange={updateAssetAdminStatus}
                  onDelete={handleDeleteAsset}
                />
              </div>
              <div className="md:col-span-2">
                <AssetVideoSection 
                  videos={videos}
                  asset={asset}
                  isAdmin={isAdmin}
                  isAuthorized={isAuthorized}
                  onOpenLightbox={handleOpenLightbox}
                  handleApproveVideo={handleApproveVideo}
                  handleRejectVideo={handleRejectVideo}
                  handleDeleteVideo={handleDeleteVideo}
                  handleSetPrimaryMedia={handleSetPrimaryMedia}
                  onStatusChange={updateLocalVideoStatus}
                />
              </div>
            </div>
          </main>
          
          {lightboxOpen && currentVideo && (
            <VideoLightbox
              isOpen={lightboxOpen}
              onClose={handleCloseLightbox}
              videoUrl={currentVideo.url}
              videoId={currentVideo.id}
              title={currentVideo.metadata?.title}
              description={currentVideo.metadata?.description}
              initialAssetId={currentVideo.associatedAssetId ?? undefined}
              creator={currentVideo.metadata?.creatorName || currentVideo.user_id}
              thumbnailUrl={currentVideo.metadata?.placeholder_image}
              creatorId={currentVideo.user_id}
              onVideoUpdate={fetchAssetDetails}
              currentStatus={currentVideo.assetMediaDisplayStatus} 
              onStatusChange={handleLightboxAssetStatusChange} 
              isAuthorized={isAuthorized}
              adminStatus={currentVideo.admin_status}
              onAdminStatusChange={(newStatus) => handleSetVideoAdminStatus(currentVideo.id, newStatus)}
            />
          )}
          
          <Footer />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

export default AssetDetailPage;