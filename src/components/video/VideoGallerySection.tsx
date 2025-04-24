import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoEntry, AdminStatus, VideoDisplayStatus } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
import { Link } from 'react-router-dom';
import VideoLightbox from '@/components/VideoLightbox';
import { Logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import UploadPage from '@/pages/upload/UploadPage';
import { cn } from '@/lib/utils';
import VideoGrid from './VideoGrid';

interface VideoGallerySectionProps {
  videos: VideoEntry[];
  header?: string;
  isLoading?: boolean;
  seeAllPath?: string;
  alwaysShowInfo?: boolean;
  /** Message to display when there are no videos to show */
  emptyMessage?: string;
  showAddButton?: boolean;
  addButtonClassification?: 'art' | 'gen';
  /** Custom number of items per row */
  itemsPerRow?: number;
  /** If true, forces creator info to only show on hover on desktop, overriding alwaysShowInfo for that element */
  forceCreatorHoverDesktop?: boolean;
  /** The current approval filter state from the parent */
  approvalFilter?: 'all' | 'curated';

  // Add props to pass down for actions and permissions
  isAdmin?: boolean;
  isAuthorized?: boolean;
  onOpenLightbox: (video: VideoEntry) => void; // Make required as parent should handle lightbox
  onApproveVideo?: (id: string) => Promise<void>;
  onDeleteVideo?: (id: string) => Promise<void>;
  onRejectVideo?: (id: string) => Promise<void>;
  onUpdateLocalVideoStatus?: (id: string, newStatus: VideoDisplayStatus) => void;
  compact?: boolean; // New prop to render section without default margins/header
}

const logger = new Logger('VideoGallerySection');

const VideoGallerySection: React.FC<VideoGallerySectionProps> = ({
  videos,
  header,
  isLoading = false,
  seeAllPath,
  alwaysShowInfo = false,
  emptyMessage,
  showAddButton = false,
  addButtonClassification = 'gen',
  itemsPerRow = 4,
  forceCreatorHoverDesktop = false,
  approvalFilter = 'curated', // Default to 'curated' if not provided
  // Destructure new props
  isAdmin = false,
  isAuthorized = false,
  onOpenLightbox,
  onApproveVideo,
  onDeleteVideo,
  onRejectVideo,
  onUpdateLocalVideoStatus,
  compact = false,
}) => {
  const isMobile = useIsMobile();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [galleryVideos, setGalleryVideos] = useState<VideoEntry[]>(videos);

  useEffect(() => {
    setGalleryVideos(videos);
  }, [videos]);

  return (
    <section className={compact ? "space-y-4" : "space-y-4 mt-10"}>
      {header && !compact && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
            {header}
          </h2>
          {seeAllPath && (
            <Link
              to={seeAllPath}
              className="text-sm text-primary hover:underline ml-auto"
            >
              See all {approvalFilter === 'curated' ? `curated ` : ''}{header} →
            </Link>
          )}
        </div>
      )}

      {isLoading ? (
        <LoraGallerySkeleton count={isMobile ? 2 : 6} />
      ) : galleryVideos.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage ?? 'There are no curated videos yet :('}</p>
      ) : (
        <VideoGrid
          videos={galleryVideos}
          itemsPerRow={isMobile ? 2 : itemsPerRow}
          isAdmin={isAdmin}
          isAuthorized={isAuthorized}
          onOpenLightbox={onOpenLightbox}
          onApproveVideo={onApproveVideo}
          onDeleteVideo={onDeleteVideo}
          onRejectVideo={onRejectVideo}
          onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
          alwaysShowInfo={alwaysShowInfo}
          forceCreatorHoverDesktop={forceCreatorHoverDesktop}
        />
      )}

      {/* Conditionally render the Add button and its Dialog */}
      {showAddButton && !compact && (
        <div className="mt-6 flex justify-start">
          <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost"
                size={isMobile ? "sm" : "default"} 
                className={cn(
                  "border border-input hover:bg-accent hover:text-accent-foreground",
                  "text-muted-foreground",
                  isMobile ? "h-9 rounded-md px-3" : "h-10 px-4 py-2"
                )}>
                Add New {header}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto top-[5vh] translate-y-0">
              <UploadPage initialMode="media" defaultClassification={addButtonClassification} hideLayout={true} />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </section>
  );
};

export default VideoGallerySection; 