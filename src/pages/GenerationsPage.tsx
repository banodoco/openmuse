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

const logger = new Logger('GenerationsPage');

// === Pagination Helper Functions ===
const ITEMS_PER_PAGE = 20; // Define page size

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
// === End Pagination Helper Functions ===

const GenerationsPage: React.FC = () => {
  logger.log('GenerationsPage component rendering');
  const galleryRef = useRef<HTMLDivElement>(null); // Ref for scrolling

  const { user, isLoading: authLoading, isAdmin } = useAuth();

  const [approvalFilter, setApprovalFilter] = usePersistentToggle(
    'generationsPageApprovalFilter', 
    'curated' // Default to curated, could be 'all'
  );

  const [currentPage, setCurrentPage] = useState(1); // State for pagination

  const { 
    videos, 
    isLoading: videosLoading, 
    refetchVideos, 
    approveVideo, 
    rejectVideo 
  } = useVideoManagement({ approvalFilter });

  // Filter for generation videos (anything not classified as 'art')
  const genVideos = useMemo(() => 
    videos.filter(v => v.metadata?.classification !== 'art'),
    [videos]
  );

  // Calculate paginated videos and total pages
  const totalPages = useMemo(() => 
    getTotalPages(genVideos.length, ITEMS_PER_PAGE),
    [genVideos]
  );

  const paginatedGenVideos = useMemo(() => 
    getPaginatedItems(genVideos, currentPage, ITEMS_PER_PAGE),
    [genVideos, currentPage]
  );
  
  // Reset page to 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [approvalFilter]);

  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1); // Index within the FULL genVideos list

  const handleOpenLightbox = useCallback((video: VideoEntry) => {
    // Find index in the full (non-paginated) list
    const index = genVideos.findIndex(v => v.id === video.id);
    if (index !== -1) {
      setLightboxVideo(video);
      setLightboxIndex(index);
    } else {
      logger.error(`[Lightbox] Could not find video ${video.id} in the full genVideos list.`);
    }
  }, [genVideos]);

  const handleCloseLightbox = useCallback(() => {
    setLightboxVideo(null);
    setLightboxIndex(-1);
  }, []);

  // Lightbox navigation uses the full genVideos list
  const handlePrevLightbox = useCallback(() => {
    if (lightboxIndex > 0) {
      const prevIndex = lightboxIndex - 1;
      setLightboxVideo(genVideos[prevIndex]);
      setLightboxIndex(prevIndex);
    }
  }, [lightboxIndex, genVideos]);

  const handleNextLightbox = useCallback(() => {
    if (lightboxIndex !== -1 && lightboxIndex < genVideos.length - 1) {
      const nextIndex = lightboxIndex + 1;
      setLightboxVideo(genVideos[nextIndex]);
      setLightboxIndex(nextIndex);
    }
  }, [lightboxIndex, genVideos]);

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
      handleCloseLightbox(); // Close lightbox after action
    } catch (error) {
      logger.error(`[Lightbox Admin] Error changing status for ${videoId} to ${newStatus}:`, error);
      toast.error("Failed to update video status.");
    }
  }, [lightboxVideo, approveVideo, rejectVideo, handleCloseLightbox]);

  const handleLightboxVideoUpdate = useCallback(() => {
    logger.log('[Lightbox Update] Triggering video refetch due to internal lightbox update.');
    refetchVideos(); 
  }, [refetchVideos]);

  // Pagination change handler
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    scrollToElementWithOffset(galleryRef.current); // Scroll to top of gallery
  }, []);

  // === Pagination UI Renderer (Copied from ArtPage) ===
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
          <PaginationItem key={i}>
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
  // === End Pagination UI Renderer ===

  const pageTitle = approvalFilter === 'all' ? 'All Generations' : 'Curated Generations';
  const pageDescription = approvalFilter === 'all' 
    ? 'Browse all community-generated videos.'
    : 'Browse the curated collection of generated videos.';

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
                   // setCurrentPage(1); // Handled by useEffect
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
          
          <div ref={galleryRef}> {/* Add ref to the container */}
            <VideoGallerySection
              header="Generations"
              // videos={genVideos} // Use paginated list
              videos={paginatedGenVideos}
              isLoading={videosLoading}
              seeAllPath={undefined}
              emptyMessage={approvalFilter === 'curated' ? "There are no curated generations yet." : "There are no generations yet."}
              approvalFilter={approvalFilter}
              onOpenLightbox={handleOpenLightbox}
              itemsPerRow={6} // Keep denser layout for generations
              forceCreatorHoverDesktop={true}
              alwaysShowInfo={true}
              showAddButton={true}
              addButtonClassification="gen"
              isAdmin={isAdmin}
            />
            {/* Render pagination controls below the gallery */}
            {renderPaginationControls()}
          </div>
        </div>
      </div>
      <Footer />

      {/* Lightbox uses full list for navigation */}
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
          
          // Use full list count for hasNext/hasPrev logic
          hasPrev={lightboxIndex > 0}
          onPrevVideo={handlePrevLightbox}
          hasNext={lightboxIndex !== -1 && lightboxIndex < genVideos.length - 1}
          onNextVideo={handleNextLightbox}
          
          onAdminStatusChange={handleAdminStatusChange}
          onVideoUpdate={handleLightboxVideoUpdate}
          isAuthorized={!!user}
        />
      )}
    </div>
  );
};

export default GenerationsPage; 