import React, { useState, useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { VideoEntry } from '@/lib/types';
import VideoCard from '@/components/video/VideoCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
import { Link } from 'react-router-dom';
import VideoLightbox from '@/components/VideoLightbox';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { AdminStatus } from '@/lib/types';
import { toast } from 'sonner';
import { useVideoManagement } from '@/hooks/useVideoManagement';

interface VideoGallerySectionProps {
  videos: VideoEntry[];
  header: string;
  isLoading?: boolean;
  seeAllPath?: string;
}

// Breakpoints – reuse the same pattern as other grids for consistency
const breakpointColumnsObj = {
  default: 3,
  1100: 2,
  640: 1,
};

const logger = new Logger('VideoGallerySection');

const VideoGallerySection: React.FC<VideoGallerySectionProps> = ({
  videos,
  header,
  isLoading = false,
  seeAllPath,
}) => {
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const { refetchVideos } = useVideoManagement();

  // Track which video should autoplay while in viewport (mobile only)
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unmountedRef = useRef(false);
  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, []);

  const handleVideoVisibilityChange = useCallback(
    (videoId: string, isVisible: boolean) => {
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
        visibilityTimeoutRef.current = null;
      }

      if (isVisible) {
        visibilityTimeoutRef.current = setTimeout(() => {
          if (!unmountedRef.current) {
            setVisibleVideoId(videoId);
          }
        }, 150);
      } else {
        setVisibleVideoId((prev) => (prev === videoId ? null : prev));
      }
    },
    []
  );

  const handleOpenLightbox = useCallback((video: VideoEntry) => {
    logger.log('Opening lightbox for video:', video.id);
    setLightboxVideo(video);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    logger.log('Closing lightbox');
    setLightboxVideo(null);
  }, []);

  // Handle admin status change from lightbox
  const handleLightboxAdminStatusChange = useCallback(async (newStatus: AdminStatus) => {
    if (!lightboxVideo) return;
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: newStatus })
        .eq('id', lightboxVideo.id);
      if (error) throw error;
      toast.success(`Admin status set to ${newStatus}`);
      // Update local lightbox state
      setLightboxVideo(prev => prev ? { ...prev, admin_status: newStatus } : prev);
      await refetchVideos();
    } catch (err) {
      logger.error('Error updating admin status:', err);
      toast.error('Failed to update admin status');
      throw err;
    }
  }, [lightboxVideo, refetchVideos]);

  return (
    <section className="space-y-4 mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
          {header}
        </h2>
        {seeAllPath && (
          <Link
            to={seeAllPath}
            className="text-sm text-primary hover:underline ml-auto"
          >
            See all featured {header} →
          </Link>
        )}
      </div>

      {isLoading ? (
        <LoraGallerySkeleton count={isMobile ? 2 : 6} />
      ) : videos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No videos found.</p>
      ) : (
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="my-masonry-grid"
          columnClassName="my-masonry-grid_column"
        >
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isAdmin={isAdmin}
              isAuthorized={isAdmin}
              onOpenLightbox={handleOpenLightbox}
              isHovering={hoveredVideoId === video.id}
              onHoverChange={(isHovering) =>
                setHoveredVideoId(isHovering ? video.id : null)
              }
              onVisibilityChange={handleVideoVisibilityChange}
              shouldBePlaying={isMobile && video.id === visibleVideoId}
            />
          ))}
        </Masonry>
      )}

      {lightboxVideo && (
        <VideoLightbox 
          isOpen={!!lightboxVideo} 
          onClose={handleCloseLightbox} 
          videoUrl={lightboxVideo.url} 
          videoId={lightboxVideo.id}
          title={lightboxVideo.metadata?.title}
          description={lightboxVideo.metadata?.description}
          thumbnailUrl={lightboxVideo.placeholder_image || lightboxVideo.metadata?.placeholder_image}
          creatorId={lightboxVideo.user_id}
          isAuthorized={isAdmin}
          adminStatus={lightboxVideo.admin_status}
          currentStatus={null}
          onStatusChange={() => Promise.resolve()}
          onAdminStatusChange={handleLightboxAdminStatusChange}
          onVideoUpdate={() => {}}
        />
      )}
    </section>
  );
};

export default VideoGallerySection; 