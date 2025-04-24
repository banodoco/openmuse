import React, { useMemo, useState, useCallback } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { Helmet } from 'react-helmet-async';
import { Logger } from '@/lib/logger';
import { usePersistentToggle } from '@/hooks/usePersistentToggle';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from '@/components/ui/separator';
import { VideoEntry, AdminStatus } from '@/lib/types';
import VideoLightbox from '@/components/VideoLightbox';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const logger = new Logger('ArtPage');

const ArtPage: React.FC = () => {
  logger.log('ArtPage component rendering');

  const { user, isLoading: authLoading, isAdmin } = useAuth();

  const [approvalFilter, setApprovalFilter] = usePersistentToggle(
    'artPageApprovalFilter', 
    'curated'
  );

  const { 
    videos, 
    isLoading: videosLoading, 
    refetchVideos, 
    approveVideo, 
    rejectVideo 
  } = useVideoManagement({ approvalFilter });

  const artVideos = useMemo(() => 
    videos.filter(v => v.metadata?.classification === 'art'),
    [videos]
  );

  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);

  const handleOpenLightbox = useCallback((video: VideoEntry) => {
    const index = artVideos.findIndex(v => v.id === video.id);
    setLightboxVideo(video);
    setLightboxIndex(index);
  }, [artVideos]);

  const handleCloseLightbox = useCallback(() => {
    setLightboxVideo(null);
    setLightboxIndex(-1);
  }, []);

  const handlePrevLightbox = useCallback(() => {
    if (lightboxIndex > 0) {
      const prevIndex = lightboxIndex - 1;
      setLightboxVideo(artVideos[prevIndex]);
      setLightboxIndex(prevIndex);
    }
  }, [lightboxIndex, artVideos]);

  const handleNextLightbox = useCallback(() => {
    if (lightboxIndex !== -1 && lightboxIndex < artVideos.length - 1) {
      const nextIndex = lightboxIndex + 1;
      setLightboxVideo(artVideos[nextIndex]);
      setLightboxIndex(nextIndex);
    }
  }, [lightboxIndex, artVideos]);

  const handleAdminStatusChange = useCallback(async (newStatus: AdminStatus) => {
    if (!lightboxVideo) return;
    const videoId = lightboxVideo.id;
    logger.log(`[Lightbox Admin] Status change requested: ${videoId} to ${newStatus}`);
    try {
      if (newStatus === 'Curated') {
        await approveVideo(videoId);
        toast.success("Video approved successfully.");
      } else if (newStatus === 'Rejected') {
        await rejectVideo(videoId);
        toast.success("Video rejected successfully.");
      } else {
        logger.warn(`[Lightbox Admin] Unhandled status change: ${newStatus} for video ${videoId}`);
        toast.info(`Status change to ${newStatus} requested.`);
      }
      handleCloseLightbox();
    } catch (error) {
      logger.error(`[Lightbox Admin] Error changing status for ${videoId} to ${newStatus}:`, error);
      toast.error("Failed to update video status.");
    }
  }, [lightboxVideo, approveVideo, rejectVideo, handleCloseLightbox]);

  const handleLightboxVideoUpdate = useCallback(() => {
    logger.log('[Lightbox Update] Triggering video refetch due to internal lightbox update.');
    refetchVideos(); 
  }, [refetchVideos]);

  const pageTitle = approvalFilter === 'all' ? 'All Art' : 'Curated Art';
  const pageDescription = approvalFilter === 'all' 
    ? 'Browse the full collection of art videos, including community uploads.'
    : 'Browse the curated collection of high-quality art videos.';

  return (
    <div className="flex flex-col min-h-screen">
       <Helmet>
        <title>{pageTitle} | OpenMuse</title>
        <meta name="description" content={pageDescription} />
      </Helmet>
      <Navigation />
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <PageHeader 
            title={pageTitle}
            description={pageDescription}
          />

          <div className="flex justify-start mt-4 mb-6">
            <ToggleGroup 
              type="single" 
              value={approvalFilter} 
              onValueChange={(value) => {
                if (value === 'curated' || value === 'all') {
                   setApprovalFilter(value);
                }
              }}
              className="bg-muted/50 p-1 rounded-lg"
            >
              <ToggleGroupItem value="curated" aria-label="Toggle curated" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
                Curated
              </ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="Toggle all" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
                All
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator className="mb-8" />
          
          <VideoGallerySection
            header="Art"
            videos={artVideos}
            isLoading={videosLoading}
            seeAllPath={undefined}
            emptyMessage={approvalFilter === 'curated' ? "There is no curated art yet." : "There is no art yet."}
            approvalFilter={approvalFilter}
            onOpenLightbox={handleOpenLightbox}
            itemsPerRow={4}
            alwaysShowInfo={true}
            showAddButton={true}
            addButtonClassification="art"
            isAdmin={isAdmin}
          />
        </div>
      </div>
      <Footer />

      {lightboxVideo && (
        <VideoLightbox
          isOpen={!!lightboxVideo}
          onClose={handleCloseLightbox}
          videoId={lightboxVideo.id}
          videoUrl={lightboxVideo.url}
          title={lightboxVideo.metadata?.title}
          description={lightboxVideo.metadata?.description}
          initialAssetId={lightboxVideo.metadata?.assetId}
          creator={lightboxVideo.metadata?.creatorName}
          creatorId={lightboxVideo.user_id}
          thumbnailUrl={lightboxVideo.metadata?.placeholder_image}
          adminStatus={lightboxVideo.admin_status}
          
          hasPrev={lightboxIndex > 0}
          onPrevVideo={handlePrevLightbox}
          hasNext={lightboxIndex !== -1 && lightboxIndex < artVideos.length - 1}
          onNextVideo={handleNextLightbox}
          
          onAdminStatusChange={handleAdminStatusChange}
          onVideoUpdate={handleLightboxVideoUpdate}
          isAuthorized={!!user}
        />
      )}
    </div>
  );
};

export default ArtPage; 