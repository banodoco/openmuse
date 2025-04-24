import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { VideoEntry, LoraAsset, VideoDisplayStatus } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import VideoCard from '@/components/video/VideoCard';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { sortAssetPageVideos } from '@/lib/utils/videoUtils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UploadPage from '@/pages/upload/UploadPage';

const logger = new Logger('AssetVideoSection');

const isVideoEntry = (item: VideoEntry): item is VideoEntry => {
  return item && typeof item === 'object' && 'id' in item && 'url' in item;
};

interface AssetVideoSectionProps {
  asset: LoraAsset | null;
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
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const isLoraPage = pathname.includes('/assets/loras/');
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [classification, setClassification] = useState<'all' | 'gen' | 'art'>('all');
  
  // State to track the ID of the video currently in view for autoplay
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  // Ref for the container holding the video grid
  const gridContainerRef = useRef<HTMLDivElement>(null);
  // Ref for debouncing the visibility change
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pagination state
  const itemsPerPage = 15; // Or make this a prop
  const [currentPage, setCurrentPage] = useState(1);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    // logger.log(`Hover change: ${videoId}, ${isHovering}`);
    setHoveredVideoId(isHovering ? videoId : null);
  };
  
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
      return filtered;
    }
  }, [sortedAndFilteredVideos, isAuthorized]);

  // Calculate total pages based on the videos to display
  const totalPages = Math.ceil(videosToDisplay.length / itemsPerPage);

  // Paginate the videos
  const paginatedVideos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    // logger.log(`Paginating videos. Current page: ${currentPage}, Start index: ${start}, Total videos: ${videosToDisplay.length}`);
    return videosToDisplay.slice(start, start + itemsPerPage);
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
      // Clear any pending timeout on unmount
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, []);

  // Callback from VideoCard when its visibility changes - with debounce
  const handleVideoVisibilityChange = useCallback((videoId: string, isVisible: boolean) => {
    logger.log(`AssetVideoSection: Visibility change reported for ${videoId}: ${isVisible}`);

    // Clear any existing timeout when visibility changes for *any* card
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = null;
    }

    if (isVisible) {
      // If a video becomes visible, set a timeout to make it the active one
      visibilityTimeoutRef.current = setTimeout(() => {
        if (!unmountedRef.current) { // Check if component is still mounted
            logger.log(`AssetVideoSection: Debounced - Setting visible video to ${videoId}`);
            setVisibleVideoId(videoId);
        }
      }, 150); // 150ms debounce delay
    } else {
      // If a video becomes hidden, check if it was the currently active one
      setVisibleVideoId(prevVisibleId => {
        if (prevVisibleId === videoId) {
          logger.log(`AssetVideoSection: Clearing visible video ${videoId} (became hidden)`);
          return null; // Clear the active video ID immediately
        }
        return prevVisibleId; // Otherwise, keep the current state
      });
    }
  }, []); // Empty dependency array as it uses refs and state setters

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

  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-muted-foreground">Videos made with this:</h2>
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
              variant="outline"
              size={isMobile ? "sm" : "default"}
              className="w-full md:w-auto"
            >
              Upload Video for {asset?.name}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto top-[5vh] translate-y-0">
            <DialogHeader>
              <DialogTitle>Upload Video for {asset?.name}</DialogTitle>
            </DialogHeader>
            <UploadPage 
              initialMode="media"
              forcedLoraId={asset?.id}
              defaultClassification={asset?.lora_type === 'Style' ? 'art' : 'gen'}
              hideLayout={true}
              onSuccess={handleUploadSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      <div ref={gridContainerRef} className="mt-6">
        {videosToDisplay.length === 0 ? (
          <EmptyState 
            title="No Videos Yet" 
            description={classification === 'all' 
              ? "No videos have been associated with this LoRA yet." 
              : `No ${classification === 'gen' ? 'generation' : 'art'} videos found for this LoRA.`} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedVideos.map((video) => {
              const isHovering = hoveredVideoId === video.id;
              const isActive = visibleVideoId === video.id;

              return (
                <VideoCard
                  key={video.id}
                  video={video}
                  isAdmin={isAdmin}
                  isAuthorized={isAuthorized}
                  isHovering={isHovering}
                  onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
                  onVisibilityChange={handleVideoVisibilityChange}
                  onOpenLightbox={onOpenLightbox}
                  onApproveVideo={handleApproveVideo}
                  onRejectVideo={handleRejectVideo}
                  onDeleteVideo={handleDeleteVideo}
                  onSetPrimaryMedia={handleSetPrimaryMedia}
                  onUpdateLocalVideoStatus={onStatusChange}
                  forceCreatorHoverDesktop={false}
                  alwaysShowInfo={false}
                />
              );
            })}
          </div>
        )}
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
                className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
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
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default AssetVideoSection;
