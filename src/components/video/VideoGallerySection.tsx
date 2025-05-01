import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoEntry, AdminStatus, VideoDisplayStatus } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
import { Link } from 'react-router-dom';
import VideoLightbox from '@/components/VideoLightbox';
import { Logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import UploadPage from '@/pages/upload/UploadPage';
import { cn } from '@/lib/utils';
import VideoGrid from './VideoGrid';

interface VideoGallerySectionProps {
  videos: VideoEntry[];
  header?: string;
  headerBgClass?: string;
  headerTextClass?: string;
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
  onSetPrimaryMedia?: (id: string) => Promise<void>;
  onUpdateLocalVideoStatus?: (id: string, newStatus: VideoDisplayStatus) => void;
  compact?: boolean; // New prop to render section without default margins/header
  onUploadSuccess?: () => void; // Add optional callback for upload success
}

const logger = new Logger('VideoGallerySection');

const VideoGallerySection: React.FC<VideoGallerySectionProps> = ({
  videos,
  header,
  headerBgClass = 'bg-gradient-to-r from-amber-50 to-transparent',
  headerTextClass = 'text-amber-700',
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
  onSetPrimaryMedia,
  onUpdateLocalVideoStatus,
  compact = false,
  onUploadSuccess,
}) => {
  const isMobile = useIsMobile();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [galleryVideos, setGalleryVideos] = useState<VideoEntry[]>(videos);

  useEffect(() => {
    setGalleryVideos(videos);
  }, [videos]);

  // New handler for upload success
  const handleUploadSuccess = useCallback(() => {
    setIsUploadModalOpen(false);
    if (onUploadSuccess) {
      onUploadSuccess(); // Call the parent's callback if provided
    }
  }, [onUploadSuccess]);

  return (
    <section className={compact ? "space-y-4" : "space-y-4 mt-4"}>
      {header && !compact && (
        <div className={cn("flex items-center justify-between px-4 py-2 rounded-md", headerBgClass)}>
          <h2 className={cn("text-xl font-semibold leading-tight tracking-tight", headerTextClass)}>
            {header}
          </h2>
          {showAddButton && (
            <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size={isMobile ? "sm" : "default"}
                  className={cn(
                    "ml-auto border hover:bg-accent hover:text-accent-foreground",
                    header === 'Generations' ? "border-neutral-300 dark:border-neutral-500" : "border-input",
                    "text-muted-foreground",
                    isMobile ? "h-9 rounded-md px-3" : "h-10 px-4 py-2"
                  )}>
                  Add New {header}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                <DialogHeader>
                  <DialogTitle>Add New {header}</DialogTitle>
                </DialogHeader>
                <UploadPage 
                  initialMode="media" 
                  defaultClassification={addButtonClassification} 
                  hideLayout={true} 
                  onSuccess={handleUploadSuccess} // Use the new handler
                />
              </DialogContent>
            </Dialog>
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
          itemsPerRow={isMobile ? 1 : itemsPerRow}
          isAdmin={isAdmin}
          isAuthorized={isAuthorized}
          onOpenLightbox={onOpenLightbox}
          onApproveVideo={onApproveVideo}
          onDeleteVideo={onDeleteVideo}
          onRejectVideo={onRejectVideo}
          onSetPrimaryMedia={onSetPrimaryMedia}
          onUpdateLocalVideoStatus={onUpdateLocalVideoStatus}
          alwaysShowInfo={alwaysShowInfo}
          forceCreatorHoverDesktop={forceCreatorHoverDesktop}
        />
      )}

      {seeAllPath && !compact && (
        <div className="mt-6 flex justify-start">
          <Link
            to={seeAllPath}
            className="text-sm text-primary hover:underline group"
          >
            See all {approvalFilter === 'curated' ? `curated ` : ''}{header}{' '}
            <span className="inline-block transition-transform duration-200 ease-in-out group-hover:translate-x-1">→</span>
          </Link>
        </div>
      )}
    </section>
  );
};

export default VideoGallerySection; 