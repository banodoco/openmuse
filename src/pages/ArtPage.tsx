import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { Helmet } from 'react-helmet-async';
import { Logger } from '@/lib/logger';
import { usePersistentToggle } from '@/hooks/usePersistentToggle';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from '@/components/ui/separator';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from '@/lib/utils';
import { VideoEntry, AdminStatus } from '@/lib/types';
import VideoLightbox from '@/components/VideoLightbox';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const logger = new Logger('ArtPage');

const ITEMS_PER_PAGE = 20;

const getPaginatedItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
    if (pageSize <= 0) return items;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, Math.min(endIndex, items.length));
};

const getTotalPages = (totalItems: number, pageSize: number): number => {
    if (pageSize <= 0 || totalItems <= 0) return 1;
    return Math.ceil(totalItems / pageSize);
};

const scrollToElementWithOffset = (element: HTMLElement | null, offset: number = -150) => {
  if (!element) return;
  const y = element.getBoundingClientRect().top + window.pageYOffset + offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
};

const ArtPage: React.FC = () => {
  logger.log('ArtPage component rendering');
  const galleryRef = useRef<HTMLDivElement>(null);

  const { user, isLoading: authLoading, isAdmin } = useAuth();

  const [approvalFilter, setApprovalFilter] = usePersistentToggle(
    'artPageApprovalFilter', 
    'curated'
  );
  
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = useMemo(() => 
    getTotalPages(artVideos.length, ITEMS_PER_PAGE),
    [artVideos]
  );

  const paginatedArtVideos = useMemo(() => 
    getPaginatedItems(artVideos, currentPage, ITEMS_PER_PAGE),
    [artVideos, currentPage]
  );
  
  useEffect(() => {
    setCurrentPage(1);
  }, [approvalFilter]);

  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);

  const handleOpenLightbox = useCallback((video: VideoEntry) => {
    const index = artVideos.findIndex(v => v.id === video.id);
    if (index !== -1) {
      setLightboxVideo(video);
      setLightboxIndex(index);
    } else {
      logger.error(`[Lightbox] Could not find video ${video.id} in the full artVideos list.`);
    }
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
  
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    scrollToElementWithOffset(galleryRef.current);
  }, []);

  const renderPaginationControls = () => {
    if (totalPages <= 1) return null;

    const handlePrevious = () => {
      if (currentPage > 1) handlePageChange(currentPage - 1);
    };

    const handleNext = () => {
      if (currentPage < totalPages) handlePageChange(currentPage + 1);
    };

    const paginationItems = [];
    const maxPagesToShow = 5; 
    const ellipsis = <PaginationEllipsis key="ellipsis" />;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        paginationItems.push(
          <PaginationItem key={i}>
            <PaginationLink href="#" isActive={currentPage === i} onClick={(e) => { e.preventDefault(); handlePageChange(i); }}>
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      paginationItems.push(
        <PaginationItem key={1}>
          <PaginationLink href="#" isActive={currentPage === 1} onClick={(e) => { e.preventDefault(); handlePageChange(1); }}>
            1
          </PaginationLink>
        </PaginationItem>
      );
      if (currentPage > 3) {
        paginationItems.push(React.cloneElement(ellipsis, { key: "start-ellipsis" }));
      }
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) {
          endPage = Math.min(totalPages - 1, maxPagesToShow - 2); 
      }
      if (currentPage >= totalPages - 2) {
          startPage = Math.max(2, totalPages - maxPagesToShow + 2); 
      }
      for (let i = startPage; i <= endPage; i++) {
        paginationItems.push(
          <PaginationItem key={i} className={cn(currentPage === i ? "" : "hidden md:list-item")}>
            <PaginationLink href="#" isActive={currentPage === i} onClick={(e) => { e.preventDefault(); handlePageChange(i); }}>
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
      if (currentPage < totalPages - 2) {
        paginationItems.push(React.cloneElement(ellipsis, { key: "end-ellipsis" }));
      }
      paginationItems.push(
        <PaginationItem key={totalPages}>
          <PaginationLink href="#" isActive={currentPage === totalPages} onClick={(e) => { e.preventDefault(); handlePageChange(totalPages); }}>
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return (
      <Pagination className="mt-8 mb-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePrevious(); }} aria-disabled={currentPage === 1} className={cn(currentPage === 1 && 'pointer-events-none opacity-50')} />
          </PaginationItem>
          {paginationItems}
          <PaginationItem>
            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); handleNext(); }} aria-disabled={currentPage === totalPages} className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

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
          
          <div ref={galleryRef}>
            <VideoGallerySection
              header="Art"
              videos={paginatedArtVideos}
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
            {renderPaginationControls()}
          </div>
        </div>
      </div>
      <Footer />

      {lightboxVideo && (
        <VideoLightbox
          isOpen={!!lightboxVideo}
          onClose={handleCloseLightbox}
          video={lightboxVideo}
          initialAssetId={lightboxVideo.metadata?.assetId}
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