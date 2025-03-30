
import React, { useState, useEffect, useRef, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import VideoThumbnailGenerator from './video/VideoThumbnailGenerator';
import VideoPreviewError from './video/VideoPreviewError';
import EmbeddedVideoPlayer from './video/EmbeddedVideoPlayer';
import StandardVideoPreview from './video/StandardVideoPreview';
import StorageVideoPlayer from './StorageVideoPlayer';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoPreview');

interface VideoPreviewProps {
  file?: File;
  url?: string;
  className?: string;
  title?: string;
  creator?: string;
  isHovering?: boolean;
  lazyLoad?: boolean;
  thumbnailUrl?: string;
}

/**
 * VideoPreview component for displaying video previews with thumbnail generation
 * and play on hover functionality.
 */
const VideoPreview: React.FC<VideoPreviewProps> = memo(({ 
  file, 
  url, 
  className,
  title,
  creator,
  isHovering: externalHoverState,
  lazyLoad = true,
  thumbnailUrl
}) => {
  const { user } = useAuth();
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const isBlobUrl = url?.startsWith('blob:');
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(thumbnailUrl || null);
  const [isHovering, setIsHovering] = useState(externalHoverState || false);
  const [internalHoverState, setInternalHoverState] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Combine external and internal hover states
  const effectiveHoverState = externalHoverState !== undefined ? externalHoverState : internalHoverState;
  
  // Force playing state update when hover state changes
  useEffect(() => {
    if (externalHoverState !== undefined) {
      logger.log(`VideoPreview: External hover state changed to ${externalHoverState}`);
      setIsHovering(externalHoverState);
      setIsPlaying(externalHoverState);
    }
  }, [externalHoverState]);
  
  useEffect(() => {
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setObjectUrl(fileUrl);
      
      return () => {
        if (fileUrl) {
          URL.revokeObjectURL(fileUrl);
        }
      };
    } else if (url && !isExternalLink) {
      setObjectUrl(url);
    }
  }, [file, url, isExternalLink]);

  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    setError(null);
    setIsPlaying(true);
  };

  const handleThumbnailGenerated = (thumbnailUrl: string) => {
    if (!posterUrl) {
      logger.log('Thumbnail generated:', thumbnailUrl.substring(0, 50) + '...');
      setPosterUrl(thumbnailUrl);
    }
  };

  const handleMouseEnter = () => {
    if (externalHoverState === undefined) {
      logger.log('Mouse entered video preview');
      setInternalHoverState(true);
      setIsHovering(true);
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    if (externalHoverState === undefined) {
      logger.log('Mouse left video preview');
      setInternalHoverState(false);
      setIsHovering(false);
      setIsPlaying(false);
    }
  };

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  const needsThumbnailGeneration = !thumbnailUrl && (file || (url && !isExternalLink && !posterUrl));

  // Important: Use pointer-events-none for the thumbnail if hovering to allow events to pass through
  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-hovering={effectiveHoverState ? "true" : "false"}
    >
      {needsThumbnailGeneration && (
        <VideoThumbnailGenerator 
          file={file}
          url={url}
          onThumbnailGenerated={handleThumbnailGenerated}
          userId={user?.id}
          saveThumbnail={true}
        />
      )}
      
      {isExternalLink ? (
        <EmbeddedVideoPlayer 
          url={url || ''}
          isPlaying={isPlaying}
          posterUrl={posterUrl}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
        />
      ) : file ? (
        <StandardVideoPreview 
          url={objectUrl}
          posterUrl={posterUrl}
          onError={handleVideoError}
          isHovering={effectiveHoverState}
        />
      ) : isBlobUrl ? (
        <StorageVideoPlayer
          videoLocation={url}
          controls={false}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={true}
          previewMode={true}
          showPlayButtonOnHover={false}
          autoPlay={effectiveHoverState}
          isHoveringExternally={effectiveHoverState}
          lazyLoad={false} // Disable lazy loading to ensure videos are ready for hover
          thumbnailUrl={thumbnailUrl || posterUrl}
          forcePreload={true} // Force preload to ensure video is ready for hover
        />
      ) : url ? (
        <StorageVideoPlayer
          videoLocation={url}
          controls={false}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={true}
          previewMode={false}
          showPlayButtonOnHover={false}
          autoPlay={effectiveHoverState}
          isHoveringExternally={effectiveHoverState}
          lazyLoad={false} // Disable lazy loading to ensure videos are ready for hover
          thumbnailUrl={thumbnailUrl || posterUrl}
          forcePreload={true} // Force preload to ensure video is ready for hover
        />
      ) : null}

      {error && <VideoPreviewError error={error} onRetry={handleRetry} videoSource={objectUrl || undefined} canRecover={false} />}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';

export default VideoPreview;
