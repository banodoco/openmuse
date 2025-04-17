
import React from 'react';
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
  onOpenLightbox,
  onDelete = () => {},
  onApprove = () => {},
  onReject = () => {},
}) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const totalPages = Math.ceil(videos.length / itemsPerPage);
  
  const paginatedVideos = videos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (videos.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No videos available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`grid ${gridCols} gap-4`}>
        {paginatedVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            isAdmin={!!isAdmin}
            onOpenLightbox={onOpenLightbox}
            onDelete={onDelete}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default VideoPaginatedGrid;
