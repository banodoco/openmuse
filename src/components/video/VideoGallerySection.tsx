import React, { useState, useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { VideoEntry, AdminStatus } from '@/lib/types';
import VideoCard from '@/components/video/VideoCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
import { Link } from 'react-router-dom';
import VideoLightbox from '@/components/VideoLightbox';
import { Logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  // Track which video should autoplay while in viewport (mobile only)
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVideoIdRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);
  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  const [galleryVideos, setGalleryVideos] = useState<VideoEntry[]>(videos);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setGalleryVideos(videos);
  }, [videos]);

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
    lastVideoIdRef.current = video.id;
    setLightboxVideo(video);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    logger.log('Closing lightbox');
    setLightboxVideo(null);
  }, []);

  const updateVideoLocally = useCallback((id: string, updater: (v: VideoEntry) => VideoEntry) => {
    setGalleryVideos(prev => prev.map(v => (v.id === id ? updater(v) : v)));
    setLightboxVideo(prev => (prev && prev.id === id ? updater(prev) : prev));
  }, []);

  const handleLightboxVideoUpdate = useCallback(async () => {
    const videoId = lastVideoIdRef.current;
    if (!videoId) return;
    try {
      const { data, error } = await supabase
        .from('media')
        .select('id, title, description')
        .eq('id', videoId)
        .single();
      if (error) throw error;
      updateVideoLocally(videoId, (v) => ({
        ...v,
        metadata: {
          ...(v.metadata || {}),
          title: data.title,
          description: data.description,
        },
      }));
    } catch (error) {
      toast.error('Failed to refresh video details');
      console.error('handleLightboxVideoUpdate error', error);
    }
  }, [updateVideoLocally]);

  const handleLightboxAdminStatusChange = useCallback(async (newStatus: AdminStatus) => {
    const videoId = lastVideoIdRef.current;
    if (!videoId) return;
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_status: newStatus, admin_reviewed: true })
        .eq('id', videoId);
      if (error) throw error;
      toast.success(`Video admin status updated to ${newStatus}`);
      updateVideoLocally(videoId, (v) => ({ ...v, admin_status: newStatus }));
    } catch (error) {
      toast.error('Failed to update admin status');
      console.error('handleLightboxAdminStatusChange error', error);
    }
  }, [updateVideoLocally]);

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
      ) : galleryVideos.length === 0 ? (
        <p className="text-muted-foreground text-sm">There are no curated videos yet :(</p>
      ) : (
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="my-masonry-grid"
          columnClassName="my-masonry-grid_column"
        >
          {galleryVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isAdmin={false}
              isAuthorized={false}
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
          isAuthorized={false}
          adminStatus={lightboxVideo.admin_status}
          currentStatus={null}
          onStatusChange={() => Promise.resolve()}
          onAdminStatusChange={handleLightboxAdminStatusChange}
          onVideoUpdate={handleLightboxVideoUpdate}
        />
      )}
    </section>
  );
};

export default VideoGallerySection; 