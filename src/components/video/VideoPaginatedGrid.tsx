
import React, { useState } from 'react';
import { VideoEntry } from '@/lib/types';
import VideoCard from './VideoCard';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface VideoPaginatedGridProps {
  videos: VideoEntry[];
  itemsPerPage: number;
  gridCols: string;
  isAdmin?: boolean;
  isAuthorized?: boolean;
  onOpenLightbox: (video: VideoEntry) => void;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const VideoPaginatedGrid: React.FC<VideoPaginatedGridProps> = ({
  videos,
  itemsPerPage,
  gridCols,
  isAdmin,
  isAuthorized = false,
  onOpenLightbox,
  onDelete = () => {},
  onApprove = () => {},
  onReject = () => {},
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const totalPages = Math.ceil(videos.length / itemsPerPage);
  
  const paginatedVideos = videos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    if (isHovering) {
      setHoveredVideoId(videoId);
    } else if (hoveredVideoId === videoId) {
      setHoveredVideoId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (onDelete) {
      await onDelete(id);
    }
  };

  const handleApprove = async (id: string) => {
    if (onApprove) {
      await onApprove(id);
    }
  };

  if (videos.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg backdrop-blur-sm animate-fade-in">
        No videos available.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className={`grid ${gridCols} gap-4`}>
        {paginatedVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            isAdmin={!!isAdmin}
            isAuthorized={!!isAuthorized}
            onOpenLightbox={onOpenLightbox}
            onDeleteVideo={handleDelete}
            onApproveVideo={handleApprove}
            isHovering={hoveredVideoId === video.id}
            onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-muted/50 transition-colors"}
              />
            </PaginationItem>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-muted/50 transition-colors"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default VideoPaginatedGrid;
