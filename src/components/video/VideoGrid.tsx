import { useState, useEffect, useRef, useMemo, useId, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { VideoEntry, AdminStatus } from "@/lib/types";
import VideoCard from "./VideoCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { cn } from "@/lib/utils";
import { Logger } from "@/lib/logger";

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
  onAdminStatusChange?: (videoId: string, newStatus: AdminStatus) => Promise<void>;
  onUpdateLocalVideoStatus?: (id: string, newStatus: string) => void;
  alwaysShowInfo?: boolean;
  forceCreatorHoverDesktop?: boolean;
  assetPrimaryMediaId?: string | null;
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
  onAdminStatusChange,
  onUpdateLocalVideoStatus,
  alwaysShowInfo = false,
  forceCreatorHoverDesktop = false,
  assetPrimaryMediaId,
}: VideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Unique id for this grid instance so layoutIds don't clash across multiple grids on the page
  const gridId = useId();

  const CHUNK_SIZE = 40; // number of videos to add each time on desktop
  const INITIAL_CHUNK = 40; // initial items to render

  // Track how many videos are currently visible (rendered)
  const [visibleCount, setVisibleCount] = useState<number>(() => Math.min(videos.length, INITIAL_CHUNK));
  // NEW: State to track unsupported video IDs on mobile
  const [unsupportedVideoIds, setUnsupportedVideoIds] = useState<Set<string>>(new Set());

  // Reset visibleCount if the videos array changes significantly (e.g., new search)
  useEffect(() => {
    setVisibleCount(Math.min(videos.length, INITIAL_CHUNK));
    setUnsupportedVideoIds(new Set()); // Reset unsupported videos when the main video list changes
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
  const logger = new Logger('VideoGrid'); // Assuming Logger is available or add import if not

  // --- NEW: Use ResizeObserver --- 
  const handleResize = useCallback((entry: ResizeObserverEntry) => {
    // Update containerWidth state using the observed width
    // Use contentBoxSize for more accurate width calculation
    const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
    setContainerWidth(width);
  }, []); // No dependencies, setContainerWidth is stable

  // Attach the observer to the containerRef
  useResizeObserver(containerRef, handleResize);
  // --- END NEW --- 

  // Define breakpoints for responsiveness
  const SM_DESKTOP_BREAKPOINT = 768;  // md
  const MD_DESKTOP_BREAKPOINT = 1024; // lg
  const LG_DESKTOP_BREAKPOINT = 1280; // xl
  const XL_DESKTOP_BREAKPOINT = 1536; // 2xl

  // Calculate rows based on container width and items per row (only for visibleVideos)
  const rows = useMemo(() => {
    // Determine how many items we should show per row depending on the screen size
    const effectiveItemsPerRow = (() => {
      if (isMobile) return 1; // Mobile always gets 1 column

      const baseItems = itemsPerRow; // The max density (4 or 6) passed as prop

      // Very Large screens (>= XL_DESKTOP): Use base density
      if (containerWidth >= XL_DESKTOP_BREAKPOINT) {
        return baseItems; // 4 or 6
      }
      // Large screens (>= LG_DESKTOP): Use base or base-1
      if (containerWidth >= LG_DESKTOP_BREAKPOINT) {
        // For 6 base, show 5. For 4 base, show 4.
        return baseItems > 4 ? Math.max(3, baseItems - 1) : baseItems; // 4 or 5
      }
      // Medium screens (>= MD_DESKTOP): Use base-1 or base-2
      if (containerWidth >= MD_DESKTOP_BREAKPOINT) {
         // For 6 base, show 4. For 4 base, show 3.
        return baseItems > 4 ? Math.max(3, baseItems - 2) : Math.max(2, baseItems - 1); // 3 or 4
      }
      // Small Desktop/Tablet (>= SM_DESKTOP): Use ~half density
      if (containerWidth >= SM_DESKTOP_BREAKPOINT) {
        // For 6 base, show 3. For 4 base, show 2.
        return Math.max(2, Math.ceil(baseItems / 2)); // 2 or 3
      }
      // Smaller than SM_DESKTOP (but not mobile) - Fallback if needed
      return 2;
    })();

    // Filter out unsupported videos on mobile first
    const filteredVisibleVideos = isMobile 
      ? visibleVideos.filter(video => !unsupportedVideoIds.has(video.id)) 
      : visibleVideos;

    if (!containerWidth || !filteredVisibleVideos.length) return [];
    
    // Helper function to get the correct aspect ratio
    const getAspectRatio = (vid: VideoEntry): number => {
      return (
        // Prefer top‑level aspectRatio prop if provided (e.g., on profile page)
        // then fall back to metadata.aspectRatio, otherwise assume 16/9.
        (vid as any).aspectRatio ?? vid.metadata?.aspectRatio ?? 16 / 9
      );
    };

    // --- Single Video Case --- 
    if (filteredVisibleVideos.length === 1) {
      const video = filteredVisibleVideos[0];
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
      return filteredVisibleVideos.map((video) => {
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
    while (cursor < filteredVisibleVideos.length) {
      const slice = filteredVisibleVideos.slice(cursor, cursor + effectiveItemsPerRow);
      const GAP_PX = 8; // Tailwind gap-2 equals 0.5rem
      const totalGapWidth = (slice.length - 1) * GAP_PX;

      // ALWAYS Use Justified row calculation
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
  }, [containerWidth, visibleVideos, itemsPerRow, isMobile, unsupportedVideoIds]);

  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    logger.log(`[VideoHoverPlayDebug] handleHoverChange: videoId=${videoId}, isHovering=${isHovering}`);
    setHoveredVideoId(isHovering ? videoId : null);
  };

  const handleVideoVisibilityChange = (videoId: string, isVisible: boolean) => {
    if (isVisible) {
      setVisibleVideoId(videoId);
    } else if (visibleVideoId === videoId) {
      setVisibleVideoId(null);
    }
  };

  // NEW: Callback for VideoCard to report unsupported format error on mobile
  const handleFormatUnsupportedOnMobile = useCallback((videoId: string) => {
    if (isMobile) {
      logger.log(`[VideoGrid] Format unsupported for video ID ${videoId} on mobile. Hiding item.`);
      setUnsupportedVideoIds(prev => new Set(prev).add(videoId));
    }
  }, [isMobile]);

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
                onAdminStatusChange={onAdminStatusChange}
                isHovering={hoveredVideoId === video.id}
                onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
                onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
                onVisibilityChange={handleVideoVisibilityChange}
                shouldBePlaying={isMobile && video.id === visibleVideoId}
                alwaysShowInfo={alwaysShowInfo}
                forceCreatorHoverDesktop={forceCreatorHoverDesktop}
                onFormatUnsupportedOnMobile={handleFormatUnsupportedOnMobile}
                assetPrimaryMediaId={assetPrimaryMediaId}
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