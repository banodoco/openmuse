import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import { AnyAsset, VideoEntry, VideoDisplayStatus, UserAssetPreferenceStatus, AdminStatus, LoraAsset, WorkflowAsset } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import AssetHeader from './components/AssetHeader';
import AssetInfoCard from './components/AssetInfoCard';
import AssetVideoSection from './components/AssetVideoSection';
import { useAssetDetails } from './hooks/useAssetDetails';
import { useAuth } from '@/hooks/useAuth';
import VideoLightbox from '@/components/VideoLightbox';
import { toast } from 'sonner';
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import LoadingState from '@/components/LoadingState';

const logger = new Logger('AssetDetailPage');

function AssetDetailPage() {
  const { id: routeAssetId } = useParams<{ id: string }>();

  useEffect(() => {
    logger.log(`[AssetLoadSpeed] AssetDetailPage MOUNTED for routeAssetId: ${routeAssetId}.`);
  }, [routeAssetId]);

  const navigate = useNavigate();
  const { user, isAdmin: isGlobalAdmin } = useAuth();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoEntry | null>(null);
  const [initialVideoParamHandled, setInitialVideoParamHandled] = useState(false);
  const [searchParams] = useSearchParams();
  
  const { asset, videos, isLoading, creatorDisplayName, curatorProfile, isLoadingCuratorProfile, isUpdatingAdminStatus, refetchAssetDetails, updateAdminStatus, updateUserStatus, updatePrimaryVideo, dataFetchAttempted, isOwner, isAdmin: isAdminViaHook } = useAssetDetails(routeAssetId);
  
  useEffect(() => {
    logger.log(`[AssetLoadSpeed] AssetDetailPage - useAssetDetails initial state: isLoading: ${isLoading}, asset: ${asset ? asset.id : 'null'}, dataFetchAttempted: ${dataFetchAttempted}`);
  }, []);

  useEffect(() => {
    if (!isLoading && dataFetchAttempted) {
      logger.log(`[AssetLoadSpeed] AssetDetailPage - LOADING COMPLETE. Asset ID: ${asset?.id ?? 'N/A'}, Videos: ${videos.length}`);
    } else if (isLoading) {
      logger.log(`[AssetLoadSpeed] AssetDetailPage - STILL LOADING... isLoading: ${isLoading}, dataFetchAttempted: ${dataFetchAttempted}, assetId from hook: ${asset?.id ?? 'N/A'}`);
    }
  }, [isLoading, asset, videos, dataFetchAttempted]);

  const isAuthorizedToEdit = isOwner || isGlobalAdmin;
  
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
    if (!isGlobalAdmin) { toast.error("Permission denied."); return; }
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Curated', admin_reviewed: true })
        .eq('id', videoId);
        
      if (error) throw error;
      toast.success('Video approved');
      await refetchAssetDetails();
    } catch (error) {
      toast.error('Failed to approve video');
    }
  };
  
  const handleRejectVideo = async (videoId: string) => {
    if (!isGlobalAdmin) { toast.error("Permission denied."); return; }
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: 'Rejected', admin_reviewed: true })
        .eq('id', videoId);
        
      if (error) throw error;
      toast.success('Video rejected');
      await refetchAssetDetails();
    } catch (error) {
      toast.error('Failed to reject video');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!isGlobalAdmin) { toast.error("Permission denied to delete video."); return; }
    try {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);

      if (error) throw error;
      toast.success('Video deleted successfully');
      await refetchAssetDetails();
      if (currentVideo?.id === videoId) handleCloseLightbox();
    } catch (error) {
      toast.error(`Failed to delete video: ${(error as Error).message || 'Unknown error'}`);
    }
  };

  const handleDeletePrimaryAsset = async () => {
    if (!isAuthorizedToEdit) {
        toast.error("Permission denied to delete this asset.");
        return;
    }
    if (!asset) {
      toast.error("Asset data not available.");
      return;
    }

    const assetIdToDelete = asset.id;
    const assetTypeToDelete = asset.type;

    try {
      const { error: deleteLinksError } = await supabase
        .from('asset_media')
        .delete()
        .eq('asset_id', assetIdToDelete);

      if (deleteLinksError) {
        logger.error(`Failed to delete asset_media links for asset ${assetIdToDelete}:`, deleteLinksError);
        throw new Error(`Could not delete asset associations.`);
      }
      logger.log(`Successfully deleted asset_media links for asset ${assetIdToDelete}.`);

      const { error: deleteAssetError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetIdToDelete);

      if (deleteAssetError) {
        logger.error(`Failed to delete asset record ${assetIdToDelete}:`, deleteAssetError);
        throw deleteAssetError;
      }
      
      toast.success(`${assetTypeToDelete.charAt(0).toUpperCase() + assetTypeToDelete.slice(1)} deleted successfully`);
      navigate('/');

    } catch (error: any) {
      logger.error(`Error during asset deletion process for ID ${assetIdToDelete}:`, error);
      toast.error(`Failed to delete asset: ${error.message || 'Unknown error'}`);
    }
  };
  
  const handleSetPrimaryMedia = async (mediaId: string) => {
    if (!isAuthorizedToEdit || !asset) { toast.error("Permission denied or asset not loaded."); return; }
    try {
      const { error } = await supabase
        .from('assets')
        .update({ primary_media_id: mediaId })
        .eq('id', asset.id);

      if (error) {
        logger.error('Error setting primary video in Supabase:', error);
        toast.error('Failed to set primary video in database');
        return;
      }

      updatePrimaryVideo(mediaId);
      toast.success('Primary video updated');
      await refetchAssetDetails({ silent: true });
    } catch (error) {
      logger.error('Error setting primary video:', error);
      toast.error('Failed to set primary video');
    }
  };
  
  const handleVideoAssetMediaStatusChange = async (videoId: string, newStatus: VideoDisplayStatus) => {
    if (!isAuthorizedToEdit || !asset?.id) { toast.error("Permission denied or asset not loaded."); return; }
    const assetIdForLink = asset.id;
    try {
      await supabase.from('asset_media').update({ status: newStatus }).eq('asset_id', assetIdForLink).eq('media_id', videoId);
      toast.success(`Video link status updated to ${newStatus}`);
      refetchAssetDetails({ silent: true }); 
    } catch (error: any) { toast.error(`Failed to update video link status: ${error.message || 'Unknown error'}`); }
  };
  
  const handleSetVideoAdminStatus = async (videoId: string, newStatus: AdminStatus) => {
    if (!isGlobalAdmin) { toast.error("Permission denied."); return; }
    try {
      await supabase
        .from('media')
        .update({ admin_status: newStatus, admin_reviewed: true })
        .eq('id', videoId);

      toast.success(`Video admin status updated to ${newStatus}`);
      refetchAssetDetails({ silent: true });
      if (currentVideo?.id === videoId) setCurrentVideo(prev => prev ? { ...prev, admin_status: newStatus } : null);
    } catch (error: any) {
      logger.error(`Error setting video admin status:`, error);
      toast.error(`Failed to update video admin status: ${error.message}`);
    }
  };
  
  const videoList = useMemo(() => videos ?? [], [videos]);

  const currentLightboxIndex = useMemo(() => (!currentVideo ? -1 : videoList.findIndex(v => v.id === currentVideo.id)), [currentVideo, videoList]);

  const handlePrevLightboxVideo = useCallback(() => {
    if (currentLightboxIndex > 0) {
      setCurrentVideo(videoList[currentLightboxIndex - 1]);
    }
  }, [currentLightboxIndex, videoList, setCurrentVideo]);

  const handleNextLightboxVideo = useCallback(() => {
    if (currentLightboxIndex !== -1 && currentLightboxIndex < videoList.length - 1) {
      setCurrentVideo(videoList[currentLightboxIndex + 1]);
    }
  }, [currentLightboxIndex, videoList, setCurrentVideo]);
  
  const videoParam = searchParams.get('video');
  useEffect(() => {
    if (videoParam && !initialVideoParamHandled && videos.length > 0) {
      const found = videos.find(v => v.id === videoParam);
      if (found) handleOpenLightbox(found);
    }
  }, [videoParam, videos, initialVideoParamHandled, handleOpenLightbox]);
  
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

  logger.log(`[AssetLoadSpeed] AssetDetailPage - MAIN CONTENT RENDER. Asset: ${asset.id}, Type: ${asset.type}, Videos: ${videos.length}`);
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
                  currentStatus={asset.user_status ?? null}
                  onStatusChange={updateUserStatus}
                  isAdmin={isGlobalAdmin}
                  isAuthorized={isAuthorizedToEdit}
                  isUpdatingAdminStatus={isUpdatingAdminStatus}
                  onAdminStatusChange={updateAdminStatus}
                  onDelete={handleDeletePrimaryAsset}
                  onDetailsUpdated={refetchAssetDetails}
                  curatorProfile={curatorProfile}
                  isLoadingCuratorProfile={isLoadingCuratorProfile}
                />
              </div>
              <div className="md:col-span-2">
                <AssetVideoSection 
                  videos={videos}
                  asset={asset}
                  isAdmin={isGlobalAdmin}
                  isAuthorized={isAuthorizedToEdit}
                  onOpenLightbox={handleOpenLightbox}
                  handleApproveVideo={handleApproveVideo}
                  handleRejectVideo={handleRejectVideo}
                  handleDeleteVideo={handleDeleteVideo}
                  handleSetPrimaryMedia={handleSetPrimaryMedia}
                  onStatusChange={handleVideoAssetMediaStatusChange}
                  refetchVideos={refetchAssetDetails}
                />
              </div>
            </div>
          </main>
          
          {lightboxOpen && currentVideo && (
            <VideoLightbox
              isOpen={lightboxOpen}
              onClose={handleCloseLightbox}
              video={currentVideo}
              initialAssetId={currentVideo.associatedAssetId ?? undefined}
              onVideoUpdate={() => refetchAssetDetails({ silent: true })}
              onStatusChange={async (videoId, newStatus) => {
                await handleVideoAssetMediaStatusChange(videoId, newStatus);
              }}
              isAuthorized={isAuthorizedToEdit}
              onAdminStatusChange={(videoId, newStatus) => handleSetVideoAdminStatus(videoId, newStatus)}
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