import { useState, useEffect, useRef, useMemo, useId } from "react";
import { Button } from "@/components/ui/button";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { VideoEntry } from "@/lib/types";
import VideoCard from "./VideoCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from "@/lib/utils";

// Define standard video resolutions and their aspect ratios
const resolutions = [
  { w: 1920, h: 1080, label: "16:9 1080p" },
  { w: 1280, h: 720, label: "HD 720p" },
  { w: 1080, h: 1920, label: "Vertical 9:16" },
  { w: 2560, h: 1440, label: "QHD" },
  { w: 720, h: 1280, label: "Vertical 720×1280" },
  { w: 640, h: 480, label: "4:3 SD" },
  { w: 1080, h: 1080, label: "Square 1:1 1080" },
];

const DEFAULT_ROW_HEIGHT = 180; // px baseline before scaling

// Define an extended type for videos with display dimensions
type DisplayVideoEntry = VideoEntry & {
  displayW: number;
  displayH: number;
};

interface VideoGridProps {
  videos: VideoEntry[];
  itemsPerRow?: number;
  isAdmin?: boolean;
  isAuthorized?: boolean;
  onOpenLightbox: (video: VideoEntry) => void;
  onApproveVideo?: (id: string) => Promise<void>;
  onDeleteVideo?: (id: string) => Promise<void>;
  onRejectVideo?: (id: string) => Promise<void>;
  onSetPrimaryMedia?: (id: string) => Promise<void>;
  onUpdateLocalVideoStatus?: (id: string, newStatus: string) => void;
  alwaysShowInfo?: boolean;
  forceCreatorHoverDesktop?: boolean;
}

const TABLET_BREAKPOINT = 1024; // px – treat widths below this as tablet (but above mobile)

const tileVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" } },
};

export default function VideoGrid({
  videos,
  itemsPerRow = 4,
  isAdmin = false,
  isAuthorized = false,
  onOpenLightbox,
  onApproveVideo,
  onDeleteVideo,
  onRejectVideo,
  onSetPrimaryMedia,
  onUpdateLocalVideoStatus,
  alwaysShowInfo = false,
  forceCreatorHoverDesktop = false,
}: VideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Unique id for this grid instance so layoutIds don't clash across multiple grids on the page
  const gridId = useId();

  const CHUNK_SIZE = 40; // number of videos to add each time on desktop
  const INITIAL_CHUNK = 40; // initial items to render

  // Track how many videos are currently visible (rendered)
  const [visibleCount, setVisibleCount] = useState<number>(() => Math.min(videos.length, INITIAL_CHUNK));

  // Reset visibleCount if the videos array changes significantly (e.g., new search)
  useEffect(() => {
    setVisibleCount(Math.min(videos.length, INITIAL_CHUNK));
  }, [videos]);

  // Use intersection observer on a sentinel element at the bottom of the grid to progressively load more
  const isSentinelVisible = useIntersectionObserver(sentinelRef, { rootMargin: '300px', threshold: 0 });

  useEffect(() => {
    if (isSentinelVisible && visibleCount < videos.length) {
      setVisibleCount(prev => Math.min(prev + CHUNK_SIZE, videos.length));
    }
  }, [isSentinelVisible, visibleCount, videos.length]);

  // Slice the videos array based on visibleCount
  const visibleVideos = useMemo(() => videos.slice(0, visibleCount), [videos, visibleCount]);

  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Update container width on resize
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Calculate rows based on container width and items per row (only for visibleVideos)
  const rows = useMemo(() => {
    // Determine how many items we should show per row depending on the screen size
    const effectiveItemsPerRow = (() => {
      if (isMobile) return 1; // already handled separately below, but keep for clarity

      // Tablet: between mobile and tablet breakpoint → show roughly half the usual density
      if (containerWidth < TABLET_BREAKPOINT) {
        return Math.max(2, Math.ceil(itemsPerRow / 2));
      }

      // Desktop/default
      return itemsPerRow;
    })();

    if (!containerWidth || !visibleVideos.length) return [];
    
    // Helper function to get the correct aspect ratio
    const getAspectRatio = (vid: VideoEntry): number => {
      return (
        // Prefer top‑level aspectRatio prop if provided (e.g., on profile page)
        // then fall back to metadata.aspectRatio, otherwise assume 16/9.
        (vid as any).aspectRatio ?? vid.metadata?.aspectRatio ?? 16 / 9
      );
    };

    // --- Single Video Case --- 
    if (visibleVideos.length === 1) {
      const video = visibleVideos[0];
      const aspectRatio = getAspectRatio(video);
      let displayH = DEFAULT_ROW_HEIGHT * 1.5; // Make single videos a bit larger than default row height
      let displayW = aspectRatio * displayH;

      // Ensure the calculated width doesn't exceed container width
      if (displayW > containerWidth) {
        displayW = containerWidth * 0.9; // Use 90% of width to leave some padding
        displayH = displayW / aspectRatio;
      }

      // Return a single row, with the single item
      const singleVideoRow: DisplayVideoEntry[] = [
        {
          ...video,
          displayW,
          displayH,
        }
      ];
      return [singleVideoRow]; // Wrap in an array as the component expects rows
    }
    // --- End Single Video Case ---
    
    // --- Mobile: Single Column Layout ---
    if (isMobile) {
      return visibleVideos.map((video) => {
        // Use the same helper as desktop to get the correct aspect ratio
        const aspectRatio = getAspectRatio(video);
        // Use full container width for the video
        const displayW = containerWidth;
        const displayH = displayW / aspectRatio;
        // Each video is its own row
        return [
          {
            ...video,
            displayW,
            displayH,
          },
        ];
      });
    }
    
    // --- Desktop: Multi-Column Layout (Existing logic) ---
    const initialRows: DisplayVideoEntry[][] = [];
    let cursor = 0;
    
    // Initial layout calculation
    while (cursor < visibleVideos.length) {
      const slice = visibleVideos.slice(cursor, cursor + effectiveItemsPerRow);
      const GAP_PX = 8; // Tailwind gap-2 equals 0.5rem
      const totalGapWidth = (slice.length - 1) * GAP_PX;

      // Check if this is the last row and it's incomplete
      if ((cursor + slice.length) === visibleVideos.length && slice.length < effectiveItemsPerRow) {
        // For an incomplete row, allocate equal width per item and calculate individual heights based on aspect ratio
        const allocatedWidth = (containerWidth - totalGapWidth) / slice.length;
        initialRows.push(
          slice.map(video => {
            const aspectRatio = getAspectRatio(video);
            const displayH = allocatedWidth / aspectRatio;
            return {
              ...video,
              displayW: allocatedWidth,
              displayH,
            };
          })
        );
      } else {
        // Justified row calculation
        const sumWidth = slice.reduce((acc, vid) => acc + getAspectRatio(vid) * DEFAULT_ROW_HEIGHT, 0);
        const availableWidth = containerWidth - totalGapWidth;
        const scale = availableWidth / sumWidth;
        const rowH = DEFAULT_ROW_HEIGHT * scale;
        initialRows.push(
          slice.map(video => {
            const aspectRatio = getAspectRatio(video);
            return {
              ...video,
              displayW: aspectRatio * rowH,
              displayH: rowH,
            };
          })
        );
      }
      cursor += slice.length;
    }

    // --- Row Balancing Logic ---
    if (initialRows.length >= 2) {
      const lastRow = initialRows[initialRows.length - 1];
      const secondLastRow = initialRows[initialRows.length - 2];
      const threshold = Math.ceil(effectiveItemsPerRow / 2);

      // Only attempt balancing when the last row is sparse compared to the target density
      if (lastRow.length < threshold && secondLastRow.length >= effectiveItemsPerRow) {
        // Move one item (the last) from the second-last row to the beginning of the last row – without mutating originals
        const itemToMove = secondLastRow[secondLastRow.length - 1];
        if (itemToMove) {
          const newSecondLastRow = secondLastRow.slice(0, -1);
          const newLastRow = [itemToMove, ...lastRow];

          // Utility to recalculate displayW / displayH for all items in a row
          const recalcRow = (rowSlice: DisplayVideoEntry[]): DisplayVideoEntry[] => {
            if (!rowSlice.length) return [];

            const GAP_PX = 8; // Must remain in sync with earlier constant
            const sumWidth = rowSlice.reduce((acc, video) => acc + getAspectRatio(video) * DEFAULT_ROW_HEIGHT, 0);
            const totalGapWidth = (rowSlice.length - 1) * GAP_PX;
            const availableWidth = containerWidth - totalGapWidth;
            const scale = availableWidth / sumWidth;
            const rowH = DEFAULT_ROW_HEIGHT * scale;

            return rowSlice.map(video => {
              const aspectRatio = getAspectRatio(video);
              return {
                ...video,
                displayW: aspectRatio * rowH,
                displayH: rowH,
              };
            });
          };

          const balancedRows = [
            ...initialRows.slice(0, -2),
            recalcRow(newSecondLastRow),
            recalcRow(newLastRow),
          ];

          return balancedRows.filter(row => row.length > 0);
        }
      }
    }
    
    return initialRows.filter(row => row.length > 0); 
  }, [containerWidth, visibleVideos, itemsPerRow, isMobile]);

  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    setHoveredVideoId(isHovering ? videoId : null);
  };

  const handleVideoVisibilityChange = (videoId: string, isVisible: boolean) => {
    if (isVisible) {
      setVisibleVideoId(videoId);
    } else if (visibleVideoId === videoId) {
      setVisibleVideoId(null);
    }
  };

  return (
    <LayoutGroup id={gridId}>
      <div
        ref={containerRef}
        className={cn(
          'w-full gap-2',
          isMobile ? 'flex flex-col' : 'flex flex-wrap'
        )}
      >
        <AnimatePresence mode="wait">
          {rows.flat().map((video: DisplayVideoEntry) => (
            <motion.div
              key={video.id}
              variants={tileVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ width: isMobile ? '100%' : video.displayW }}
              className="relative rounded-lg"
            >
              <VideoCard
                video={video}
                isAdmin={isAdmin}
                isAuthorized={isAuthorized}
                onOpenLightbox={onOpenLightbox}
                onApproveVideo={onApproveVideo}
                onDeleteVideo={onDeleteVideo}
                onRejectVideo={onRejectVideo}
                onSetPrimaryMedia={onSetPrimaryMedia}
                isHovering={hoveredVideoId === video.id}
                onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
                onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
                onVisibilityChange={handleVideoVisibilityChange}
                shouldBePlaying={isMobile && video.id === visibleVideoId}
                alwaysShowInfo={alwaysShowInfo}
                forceCreatorHoverDesktop={forceCreatorHoverDesktop}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {/* Sentinel element to trigger loading more videos */}
        <div ref={sentinelRef} className="w-full h-px" />
      </div>
    </LayoutGroup>
  );
}