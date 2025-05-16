import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { VideoEntry, AnyAsset, VideoDisplayStatus, LoraAsset } from '@/lib/types';
import { cn } from '@/lib/utils';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from 'react-router-dom';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { sortAssetPageVideos } from '@/lib/utils/videoUtils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UploadPage from '@/pages/upload/UploadPage';
import { useIsMobile } from '@/hooks/use-mobile';

const logger = new Logger('AssetVideoSection');

interface AssetVideoSectionProps {
  asset: AnyAsset | null;
  videos: VideoEntry[];
  isAdmin: boolean;
  onOpenLightbox: (video: VideoEntry) => void;
  handleApproveVideo: (videoId: string) => Promise<void>;
  handleDeleteVideo: (videoId: string) => Promise<void>;
  handleRejectVideo: (videoId: string) => Promise<void>;
  handleSetPrimaryMedia: (mediaId: string) => Promise<void>;
  isAuthorized: boolean;
  onStatusChange: (videoId: string, newStatus: VideoDisplayStatus, type: 'assetMedia' | 'user') => void;
  refetchVideos: () => void;
}

const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
  asset,
  videos,
  isAdmin,
  onOpenLightbox,
  handleApproveVideo,
  handleDeleteVideo,
  handleRejectVideo,
  handleSetPrimaryMedia,
  isAuthorized,
  onStatusChange,
  refetchVideos
}) => {
  logger.log('[WorkflowVideoDebug] AssetVideoSection received props - Asset:', asset, 'Videos:', videos);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const [classification, setClassification] = useState<'all' | 'gen' | 'art'>('all');
  
  // Ref for scrolling to the top of the section when pagination changes
  const gridContainerRef = useRef<HTMLDivElement>(null);
  
  // Pagination state
  const itemsPerPage = 15; // Or make this a prop
  const [currentPage, setCurrentPage] = useState(1);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const sortedAndFilteredVideos = useMemo(() => {
    // logger.log(`Filtering videos. Initial count: ${videos?.length || 0}, classification: ${classification}`);
    if (!videos) return [];
    let filtered = videos;
    if (classification !== 'all') {
      filtered = videos.filter(v => v.metadata?.classification === classification);
    }
    // logger.log(`Videos after classification filter: ${filtered.length}`);

    // Use the utility function for sorting
    const sorted = sortAssetPageVideos(filtered, asset?.primary_media_id);
    
    // logger.log(`Videos after sorting: ${sorted.length}`);
    logger.log('[WorkflowVideoDebug] sortedAndFilteredVideos:', sorted);
    return sorted;
  }, [videos, classification, asset?.primary_media_id]);

  const videosToDisplay = useMemo(() => {
    // logger.log(`Filtering by authorization. isAuthorized: ${isAuthorized}`);
    if (isAuthorized) {
      // logger.log(`Authorized user, returning all sorted videos: ${sortedAndFilteredVideos.length}`);
      return sortedAndFilteredVideos;
    } else {
      // logger.log(`Non-authorized user, filtering out hidden videos`);
      const filtered = sortedAndFilteredVideos.filter(video => video.assetMediaDisplayStatus !== 'Hidden');
      // logger.log(`Filtered videos count: ${filtered.length}`);
      logger.log('[WorkflowVideoDebug] videosToDisplay (after auth filter):', filtered);
      return filtered;
    }
  }, [sortedAndFilteredVideos, isAuthorized]);

  // Calculate total pages based on the videos to display
  const totalPages = Math.ceil(videosToDisplay.length / itemsPerPage);

  // Paginate the videos
  const paginatedVideos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    // logger.log(`Paginating videos. Current page: ${currentPage}, Start index: ${start}, Total videos: ${videosToDisplay.length}`);
    const paged = videosToDisplay.slice(start, start + itemsPerPage);
    logger.log('[WorkflowVideoDebug] paginatedVideos being passed to VideoGallerySection:', paged);
    return paged;
  }, [videosToDisplay, currentPage, itemsPerPage]);

  // Reset page when the classification filter changes only
  useEffect(() => {
    setCurrentPage(1);
  }, [classification]);

  // Ensure the current page is still valid after the list of videos changes.
  useEffect(() => {
    const newTotalPages = Math.max(1, Math.ceil(videosToDisplay.length / itemsPerPage));
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages);
    }
  }, [videosToDisplay.length, itemsPerPage, currentPage]);

  // Add a ref to track mounted state for cleanup
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const scrollToGridWithOffset = (offset: number = -150) => {
    if (gridContainerRef.current) {
      const y = gridContainerRef.current.getBoundingClientRect().top + window.pageYOffset + offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleUploadSuccess = () => {
    setIsUploadModalOpen(false);
    // Optional: refetch video data if needed
    if (refetchVideos) {
      refetchVideos();
    }
  };

  const assetTypeDisplay = asset?.type ? asset.type.charAt(0).toUpperCase() + asset.type.slice(1) : 'Asset';
  const defaultUploadClassification = asset?.type === 'lora' && (asset as LoraAsset).lora_type === 'Style' ? 'art' : 'gen';

  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-muted-foreground">Example Videos</h2>
        <Select 
          value={classification} 
          onValueChange={(value: string) => setClassification(value as 'all' | 'gen' | 'art')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Videos</SelectItem>
            <SelectItem value="gen">Generation</SelectItem>
            <SelectItem value="art">Art</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="mb-4">
        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost"
              size={isMobile ? "sm" : "default"}
              className={cn(
                "border border-input hover:bg-accent hover:text-accent-foreground",
                "text-muted-foreground",
                "w-full md:w-auto",
                isMobile ? "h-9 rounded-md px-3" : "h-10 px-4 py-2"
              )}
            >
              Upload videos for this {assetTypeDisplay.toLowerCase()}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
            <DialogHeader>
              <DialogTitle>Upload Video for {asset?.name}</DialogTitle>
            </DialogHeader>
            <UploadPage 
              initialMode="media"
              forcedLoraId={asset?.id}
              defaultClassification={defaultUploadClassification}
              hideLayout={true}
              onSuccess={handleUploadSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      <div ref={gridContainerRef} className="mt-6">
        <VideoGallerySection
          videos={paginatedVideos}
          isLoading={!asset || !videos}
          isAdmin={isAdmin}
          isAuthorized={isAuthorized}
          onOpenLightbox={onOpenLightbox}
          onApproveVideo={handleApproveVideo}
          onRejectVideo={handleRejectVideo}
          onDeleteVideo={handleDeleteVideo}
          onSetPrimaryMedia={handleSetPrimaryMedia}
          onUpdateLocalVideoStatus={(id, newStatus) => onStatusChange(id, newStatus as VideoDisplayStatus, 'assetMedia')}
          itemsPerRow={3}
          alwaysShowInfo={false}
          compact={true}
          emptyMessage={classification === 'all' 
              ? `No videos have been associated with this ${assetTypeDisplay.toLowerCase()} yet.` 
              : `No ${classification === 'gen' ? 'generation' : 'art'} videos found for this ${assetTypeDisplay.toLowerCase()}.`}
        />
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                    scrollToGridWithOffset();
                  }
                }}
                aria-disabled={currentPage === 1}
                className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
              />
            </PaginationItem>
            {[...Array(totalPages)].map((_, i) => {
              const page = i + 1;
              if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(page);
                        scrollToGridWithOffset();
                      }}
                      isActive={page === currentPage}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              } else if (Math.abs(page - currentPage) === 2) {
                return <PaginationItem key={`ellipsis-${page}`}><span className="px-2">...</span></PaginationItem>;
              }
              return null;
            })}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) {
                    setCurrentPage(currentPage + 1);
                    scrollToGridWithOffset();
                  }
                }}
                aria-disabled={currentPage === totalPages}
                className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default AssetVideoSection;
