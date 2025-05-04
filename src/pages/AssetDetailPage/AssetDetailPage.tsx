import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [initialVideoParamHandled, setInitialVideoParamHandled] = useState(false);
  const [searchParams] = useSearchParams();
  
  const {
    asset,
    videos,
    isLoading,
    creatorDisplayName,
    curatorProfile,
    isLoadingCuratorProfile,
    currentStatus,
    isUpdatingAdminStatus,
    refetchAssetDetails,
    updateAdminStatus,
    updateUserStatus,
    updatePrimaryVideo,
    deleteAsset,
    dataFetchAttempted,
    isOwner,
    isAdmin: isAdminUser
  } = useAssetDetails(id);
  
  const isAuthorizedToEdit = isOwner || isAdminUser;
  
  const handleOpenLightbox = (video: VideoEntry) => {
    setCurrentVideo(video);
    setLightboxOpen(true);
    setInitialVideoParamHandled(true);
  };
  
  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setCurrentVideo(null);
  };
  
  const handleApproveVideo = async (videoId: string) => {
    if (!isAdminUser) { toast.error("Permission denied."); return; }
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Curated' })
        .eq('id', videoId);
        
      if (error) throw error;
      toast.success('Video approved');
      await refetchAssetDetails();
    } catch (error) {
      toast.error('Failed to approve video');
    }
  };
  
  const handleRejectVideo = async (videoId: string) => {
    if (!isAdminUser) { toast.error("Permission denied."); return; }
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Rejected' })
        .eq('id', videoId);
        
      if (error) throw error;
      toast.success('Video rejected');
      await refetchAssetDetails();
    } catch (error) {
      toast.error('Failed to reject video');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!isAdminUser) { toast.error("Permission denied."); return; }
    try {
      const { data: mediaRecord, error: fetchError } = await supabase
        .from('media')
        .select('url, placeholder_image')
        .eq('id', videoId)
        .single();

      if (fetchError || !mediaRecord) {
        throw new Error(`Could not fetch media record ${videoId}.`);
      }
      
      const videoPath = mediaRecord.url;
      const thumbnailPath = mediaRecord.placeholder_image;

      if (videoPath) {
        try {
          const { data: deleteData, error: storageVideoError } = await supabase.storage
            .from('videos')
            .remove([videoPath]);
          if (storageVideoError) {
            toast.warning(`Could not delete video file from storage.`);
          }
        } catch (storageError) {
           toast.warning(`Error occurred during video file deletion.`);
        }
      }
      
      if (thumbnailPath) {
         try {
            const { data: deleteData, error: storageThumbnailError } = await supabase.storage
              .from('thumbnails')
              .remove([thumbnailPath]);
            if (storageThumbnailError) {
              toast.warning(`Could not delete thumbnail file from storage.`);
            }
         } catch (storageError) {
            toast.warning(`Error occurred during thumbnail file deletion.`);
         }
      }

      const { error: dbError } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);

      if (dbError) {
        throw dbError;
      }

      deleteAsset(videoId);
      toast.success('Video deleted successfully');

    } catch (error) {
      toast.error(`Failed to delete video: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDeleteAsset = async () => {
    if (!isAuthorizedToEdit) {
        toast.error("You don't have permission to delete this asset.");
        return;
    }
    if (!asset) {
      toast.error("Asset data not available.");
      return;
    }

    const assetId = asset.id;

    try {
      const { error: deleteLinksError } = await supabase
        .from('asset_media')
        .delete()
        .eq('asset_id', assetId);

      if (deleteLinksError) {
        logger.error(`Failed to delete asset_media links for asset ${assetId}:`, deleteLinksError);
        throw new Error(`Could not delete asset associations.`);
      }
      logger.log(`Successfully deleted asset_media links for asset ${assetId}.`);

      const { error: deleteAssetError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);

      if (deleteAssetError) {
        logger.error(`Failed to delete asset record ${assetId}:`, deleteAssetError);
        throw deleteAssetError;
      }
      
      toast.success('Asset deleted successfully');
      navigate('/');

    } catch (error: any) {
      logger.error(`Error during asset deletion process for ID ${assetId}:`, error);
      toast.error(`Failed to delete asset: ${error.message || 'Unknown error'}`);
    }
  };
  
  const handleSetPrimaryMedia = async (mediaId: string) => {
    if (!updatePrimaryVideo) return; 
    try {
      await updatePrimaryVideo(mediaId);
      toast.success('Primary video updated');
    } catch (error) {
      logger.error('Error setting primary video:', error);
      toast.error('Failed to set primary video');
    }
  };
  
  const handleLightboxAssetStatusChange = async (newStatus: VideoDisplayStatus) => {
    if (!currentVideo || !asset?.id) {
      logger.warn('Attempted to change status without video or asset ID');
      return;
    }

    const videoId = currentVideo.id;
    const assetId = asset.id;
    const previousStatus = currentVideo.assetMediaDisplayStatus;

    logger.log(`[AssetDetailPage] handleLightboxAssetStatusChange initiated for video ${videoId} on asset ${assetId} to status ${newStatus}`);

    updateUserStatus(newStatus);
    setCurrentVideo(prev => prev ? { ...prev, assetMediaDisplayStatus: newStatus } : null);

    try {
      logger.log(`[AssetDetailPage] Attempting database update for asset_media: asset ${assetId}, media ${videoId}, status ${newStatus}`);
      const { error } = await supabase
        .from('asset_media')
        .update({ status: newStatus })
        .eq('asset_id', assetId)
        .eq('media_id', videoId);

      if (error) {
        logger.error(`[AssetDetailPage] Database update failed for asset_media (${assetId}, ${videoId}):`, error);
        throw error;
      }

      logger.log(`[AssetDetailPage] Database update successful for asset_media (${assetId}, ${videoId}).`);
      toast.success(`Video status updated to ${newStatus}`);

    } catch (error: any) {
      logger.error(`[AssetDetailPage] Error during handleLightboxAssetStatusChange for video ${videoId}:`, error);
      toast.error(`Failed to update video status: ${error.message || 'Unknown error'}`);

      logger.log(`[AssetDetailPage] Rolling back optimistic UI update for video ${videoId} to status ${previousStatus}`);
      updateUserStatus(previousStatus);
      setCurrentVideo(prev => prev ? { ...prev, assetMediaDisplayStatus: previousStatus } : null);
    }
  };
  
  const handleListVideoStatusChange = async (videoId: string, newStatus: VideoDisplayStatus) => {
    if (!asset?.id) {
      logger.warn('[handleListVideoStatusChange] Asset ID missing, cannot update status.');
      toast.error("Cannot update status: Asset information is missing.");
      return;
    }
    const assetId = asset.id;
    const video = videos.find(v => v.id === videoId);
    const previousStatus = video?.assetMediaDisplayStatus ?? null;

    if (previousStatus === null) {
        logger.warn(`[handleListVideoStatusChange] Could not find video with ID ${videoId} in local state.`);
        toast.error("Could not find video details to update status.");
        return;
    }

    logger.log(`[AssetDetailPage] handleListVideoStatusChange initiated for video ${videoId} on asset ${assetId} to status ${newStatus}`);

    updateUserStatus(newStatus);

    try {
      logger.log(`[AssetDetailPage] Attempting database update for asset_media: asset ${assetId}, media ${videoId}, status ${newStatus}`);
      const { error } = await supabase
        .from('asset_media')
        .update({ status: newStatus })
        .eq('asset_id', assetId)
        .eq('media_id', videoId);

      if (error) {
        logger.error(`[AssetDetailPage] Database update failed for asset_media (${assetId}, ${videoId}):`, error);
        throw error;
      }

      logger.log(`[AssetDetailPage] Database update successful for asset_media (${assetId}, ${videoId}).`);
      toast.success(`Video status updated to ${newStatus}`);

    } catch (error: any) {
      logger.error(`[AssetDetailPage] Error during handleListVideoStatusChange for video ${videoId}:`, error);
      toast.error(`Failed to update video status: ${error.message || 'Unknown error'}`);

      logger.log(`[AssetDetailPage] Rolling back optimistic UI update for video ${videoId} to status ${previousStatus}`);
      updateUserStatus(previousStatus);
    }
  };
  
  const handleSetVideoAdminStatus = async (videoId: string, newStatus: AdminStatus) => {
    if (!isAdminUser) { toast.error("Permission denied."); return; }
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: newStatus, admin_reviewed: true })
        .eq('id', videoId);

      if (error) throw error;

      toast.success(`Video admin status updated to ${newStatus}`);

      await refetchAssetDetails({ silent: true });

      setCurrentVideo(prevVideo =>
        prevVideo && prevVideo.id === videoId
          ? { ...prevVideo, admin_status: newStatus }
          : prevVideo
      );

    } catch (error: any) {
      logger.error(`[AssetDetailPage] Error setting video admin status:`, error);
      toast.error(`Failed to update video admin status: ${error.message}`);
    }
  };
  
  const videoList = useMemo(() => {
    return videos ?? [];
  }, [videos]);

  const currentLightboxIndex = useMemo(() => {
    if (!currentVideo) return -1;
    return videoList.findIndex(v => v.id === currentVideo.id);
  }, [currentVideo, videoList]);

  const handlePrevLightboxVideo = useCallback(() => {
    if (currentLightboxIndex > 0) {
      setCurrentVideo(videoList[currentLightboxIndex - 1]);
    }
  }, [currentLightboxIndex, videoList]);

  const handleNextLightboxVideo = useCallback(() => {
    if (currentLightboxIndex !== -1 && currentLightboxIndex < videoList.length - 1) {
      setCurrentVideo(videoList[currentLightboxIndex + 1]);
    }
  }, [currentLightboxIndex, videoList]);
  
  const videoParam = searchParams.get('video');
  useEffect(() => {
    if (!videoParam) return;
    if (initialVideoParamHandled) return;
    if (currentVideo && currentVideo.id === videoParam) return;
    const found = videos.find(v => v.id === videoParam);
    if (found) {
      handleOpenLightbox(found);
      setInitialVideoParamHandled(true);
    }
  }, [videoParam, videos, currentVideo, initialVideoParamHandled, handleOpenLightbox]);
  
  if (isLoading) {
    return (
      <ErrorBoundary fallbackRender={({ error }) => {
        console.error("ErrorBoundary (Loading Asset): Caught error -", error);
        return <div className="p-4 text-red-500">Error loading asset details: {error.message}</div>;
      }}>
        <Suspense fallback={<LoadingState />}>
          <div className="w-full min-h-screen flex flex-col">
            <Helmet>
              <title>Loading Asset Details</title>
            </Helmet>
            <main className="flex-grow">
            </main>
            <Footer />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }
  
  if (!asset) {
    return (
      <ErrorBoundary fallbackRender={({ error }) => {
        console.error("ErrorBoundary (Determining Asset): Caught error -", error);
        return <div className="p-4 text-red-500">Error determining asset: {error.message}</div>;
      }}>
        <Suspense fallback={<LoadingState />}>
          <div className="w-full min-h-screen flex flex-col">
            <Helmet>
              <title>Error Determining Asset</title>
            </Helmet>
            <main className="flex-grow">
            </main>
            <Footer />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallbackRender={({ error }) => {
      console.error("ErrorBoundary (Main Render): Caught error -", error);
      return <div className="p-4 text-red-500">An error occurred: {error.message}</div>;
    }}>
      <Suspense fallback={<LoadingState />}>
        <div className="w-full min-h-screen flex flex-col">
          <Helmet>
            <title>{`${asset.name || 'Asset'} Details - OpenMuse`}</title>
          </Helmet>
          <Navigation />
          <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
            <div>
              <AssetHeader 
                asset={asset} 
                creatorName={creatorDisplayName}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                <AssetInfoCard 
                  asset={asset}
                  isAuthorizedToEdit={isAuthorizedToEdit}
                  userIsLoggedIn={!!user}
                  currentStatus={currentStatus}
                  onStatusChange={updateUserStatus}
                  isAdmin={isAdminUser}
                  isAuthorized={isAuthorizedToEdit}
                  isUpdatingAdminStatus={isUpdatingAdminStatus}
                  onAdminStatusChange={updateAdminStatus}
                  onDelete={handleDeleteAsset}
                  onDetailsUpdated={refetchAssetDetails}
                  curatorProfile={curatorProfile}
                  isLoadingCuratorProfile={isLoadingCuratorProfile}
                />
              </div>
              <div className="md:col-span-2">
                <AssetVideoSection 
                  videos={videos}
                  asset={asset}
                  isAdmin={isAdminUser}
                  isAuthorized={isAuthorizedToEdit}
                  onOpenLightbox={handleOpenLightbox}
                  handleApproveVideo={handleApproveVideo}
                  handleRejectVideo={handleRejectVideo}
                  handleDeleteVideo={handleDeleteVideo}
                  handleSetPrimaryMedia={handleSetPrimaryMedia}
                  onStatusChange={handleListVideoStatusChange}
                  refetchVideos={refetchAssetDetails}
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
              onVideoUpdate={() => refetchAssetDetails({ silent: true })}
              currentStatus={currentVideo.assetMediaDisplayStatus} 
              onStatusChange={handleLightboxAssetStatusChange} 
              isAuthorized={isAuthorizedToEdit}
              adminStatus={currentVideo.admin_status}
              onAdminStatusChange={(newStatus) => handleSetVideoAdminStatus(currentVideo.id, newStatus)}
              hasPrev={currentLightboxIndex > 0}
              hasNext={currentLightboxIndex !== -1 && currentLightboxIndex < videoList.length - 1}
              onPrevVideo={handlePrevLightboxVideo}
              onNextVideo={handleNextLightboxVideo}
            />
          )}
          
          <Footer />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

export default AssetDetailPage;