import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { VideoEntry, LoraAsset, VideoDisplayStatus } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import VideoCard from '@/components/video/VideoCard';
import LoRAVideoUploader from '@/components/lora/LoRAVideoUploader';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Masonry from 'react-masonry-css';
import { DummyCard, generateDummyItems } from '@/components/common/DummyCard';
import { useLocation } from 'react-router-dom';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const logger = new Logger('AssetVideoSection');

const breakpointColumnsObj = {
  default: 3,
  1100: 3,
  700: 2,
  500: 1
};

const isVideoEntry = (item: VideoEntry | { type: 'dummy' }): item is VideoEntry => {
  return !('type' in item && item.type === 'dummy');
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

    // Sort: primary first, then featured, then by date
    filtered.sort((a, b) => {
      const aIsPrimary = a.id === asset?.primary_media_id;
      const bIsPrimary = b.id === asset?.primary_media_id;
      const aIsFeatured = a.admin_status === 'Featured';
      const bIsFeatured = b.admin_status === 'Featured';

      if (aIsPrimary !== bIsPrimary) return aIsPrimary ? -1 : 1;
      if (aIsFeatured !== bIsFeatured) return aIsFeatured ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    // logger.log(`Videos after sorting: ${filtered.length}`);
    return filtered;
  }, [videos, classification, asset?.primary_media_id]);

  const getItemsWithDummies = <T extends VideoEntry>(
    allItems: T[]
  ): Array<T | { type: 'dummy'; id: string; colorClass: string }> => {
    if (allItems.length > 4 && allItems.length < 10) {
      const dummyItems = generateDummyItems(6, allItems.length);
      return [...allItems, ...dummyItems];
    } else {
      return allItems;
    }
  };

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
    return videosToDisplay.slice(start, start + itemsPerPage);
  }, [videosToDisplay, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [classification, videos]); // Also reset if base videos change

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

  const itemsToDisplay = useMemo(() => getItemsWithDummies(paginatedVideos), [paginatedVideos]); // Paginate before adding dummies
  
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
        <LoRAVideoUploader 
          assetId={asset?.id || ''} 
          assetName={asset?.name || ''} 
          onUploadsComplete={refetchVideos}
          isLoggedIn={!!user}
        />
      </div>
      
      {videosToDisplay.length > 0 ? (
        <div ref={gridContainerRef} className="relative pt-6">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {itemsToDisplay.map(item => {
              if (isVideoEntry(item)) {
                return (
                  <VideoCard
                    key={item.id}
                    video={item}
                    isAdmin={isAdmin}
                    isAuthorized={isAuthorized}
                    onOpenLightbox={onOpenLightbox}
                    onApproveVideo={handleApproveVideo}
                    onDeleteVideo={handleDeleteVideo}
                    onRejectVideo={handleRejectVideo}
                    onSetPrimaryMedia={handleSetPrimaryMedia}
                    isHovering={hoveredVideoId === item.id}
                    onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)}
                    onUpdateLocalVideoStatus={onStatusChange}
                    // Pass down visibility callback and play state
                    onVisibilityChange={handleVideoVisibilityChange}
                    shouldBePlaying={item.id === visibleVideoId} // Only true if this video is the visible one
                  />
                );
              } else {
                return (
                  <DummyCard
                    key={item.id}
                    id={item.id}
                    colorClass={item.colorClass}
                  />
                );
              }
            })}
          </Masonry>
          {/* Pagination Controls */} 
          {totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => {
                      // Scroll first
                      gridContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      // Then update page after a delay
                      setTimeout(() => {
                        if (!unmountedRef.current) {
                            setCurrentPage((p) => Math.max(1, p - 1));
                        }
                      }, 300); // Changed to 300ms
                    }}
                    className={
                      currentPage === 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer hover:bg-muted/50 transition-colors'
                    }
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => {
                        if (page !== currentPage) {
                          // Scroll first
                          gridContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          // Then update page after a delay
                          setTimeout(() => {
                            if (!unmountedRef.current) {
                                setCurrentPage(page);
                            }
                          }, 300); // Changed to 300ms
                        }
                      }}
                      isActive={currentPage === page}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => {
                      // Scroll first
                      gridContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      // Then update page after a delay
                      setTimeout(() => {
                        if (!unmountedRef.current) {
                            setCurrentPage((p) => Math.min(totalPages, p + 1));
                        }
                      }, 300); // Changed to 300ms
                    }}
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer hover:bg-muted/50 transition-colors'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      ) : (
        <EmptyState 
          title="No Videos"
          description={classification === 'all' 
            ? "No videos are currently associated with this LoRA."
            : `No ${classification} videos found for this LoRA.`}
        />
      )}
    </div>
  );
};

export default AssetVideoSection;
