import { useState, useEffect, useRef, useMemo, useId } from "react";
import { Button } from "@/components/ui/button";
import { motion, LayoutGroup } from "framer-motion";
import { VideoEntry } from "@/lib/types";
import VideoCard from "./VideoCard";
import { useIsMobile } from "@/hooks/use-mobile";

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
  // Unique id for this grid instance so layoutIds don't clash across multiple grids on the page
  const gridId = useId();
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

  // Calculate rows based on container width and items per row
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

    if (!containerWidth || !videos.length) return [];
    
    // Helper function to get the correct aspect ratio
    const getAspectRatio = (vid: VideoEntry): number => {
      return (
        // Prefer top‑level aspectRatio prop if provided (e.g., on profile page)
        // then fall back to metadata.aspectRatio, otherwise assume 16/9.
        (vid as any).aspectRatio ?? vid.metadata?.aspectRatio ?? 16 / 9
      );
    };

    // --- Single Video Case --- 
    if (videos.length === 1) {
      const video = videos[0];
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
      return videos.map((video) => {
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
    while (cursor < videos.length) {
      const slice = videos.slice(cursor, cursor + effectiveItemsPerRow);
      const GAP_PX = 8; // Tailwind gap-2 equals 0.5rem (assuming root font-size 16px)

      const sumWidth = slice.reduce((acc, vid) => {
        const aspectRatio = getAspectRatio(vid);
        return acc + aspectRatio * DEFAULT_ROW_HEIGHT;
      }, 0);

      // Account for total horizontal gaps in the current row to avoid overflow
      const totalGapWidth = (slice.length - 1) * GAP_PX;

      const availableWidth = containerWidth - totalGapWidth;

      const scale = availableWidth / sumWidth;
      const rowH = DEFAULT_ROW_HEIGHT * scale;
      
      initialRows.push(
        slice.map(video => {
          // Use metadata.aspectRatio again
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
  }, [containerWidth, videos, itemsPerRow, isMobile]);

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
      <div ref={containerRef} className="w-full">
        {rows.map((row, rIdx) => (
          <motion.div
            key={`row-${rIdx}`}
            layout="position"
            className="flex gap-2 mb-2"
          >
            {row.map((video: DisplayVideoEntry) => (
              <motion.div
                key={video.id}
                layout="position"
                layoutId={`${gridId}-${video.id}`}
                style={{ width: video.displayW, height: video.displayH }}
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
          </motion.div>
        ))}
      </div>
    </LayoutGroup>
  );
}