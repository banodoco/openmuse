
import React, { useState, useEffect, useRef, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import VideoThumbnailGenerator from './video/VideoThumbnailGenerator';
import VideoPreviewError from './video/VideoPreviewError';
import EmbeddedVideoPlayer from './video/EmbeddedVideoPlayer';
import StandardVideoPreview from './video/StandardVideoPreview';
import StorageVideoPlayer from './StorageVideoPlayer';
import { Logger } from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const isBlobUrl = url?.startsWith('blob:');
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(thumbnailUrl || null);
  const [isHovering, setIsHovering] = useState(externalHoverState || false);
  const [internalHoverState, setInternalHoverState] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [forceGenerate, setForceGenerate] = useState(!thumbnailUrl);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(!!thumbnailUrl);
  const componentId = useRef(`video_preview_${Math.random().toString(36).substring(2, 9)}`);
  const [thumbnailGenerationAttempts, setThumbnailGenerationAttempts] = useState(0);
  const thumbnailGeneratorMounted = useRef(false);
  
  // Log component mount with ID for tracking
  useEffect(() => {
    logger.log(`VideoPreview mounting [${componentId.current}] URL: ${url ? url.substring(0, 30) + '...' : 'none'}`);
    logger.log(`Initial state [${componentId.current}]: thumbnailUrl: ${thumbnailUrl ? 'provided' : 'none'}, forceGenerate: ${forceGenerate}`);
    
    return () => {
      logger.log(`VideoPreview unmounting [${componentId.current}]`);
      thumbnailGeneratorMounted.current = false;
    };
  }, []);
  
  // Combine external and internal hover states
  const effectiveHoverState = externalHoverState !== undefined ? externalHoverState : internalHoverState;
  
  // Force playing state update when hover state changes
  useEffect(() => {
    if (externalHoverState !== undefined) {
      logger.log(`VideoPreview [${componentId.current}]: External hover state changed to ${externalHoverState}`);
      setIsHovering(externalHoverState);
      // Only auto-play on hover for desktop - not on mobile
      if (!isMobile) {
        setIsPlaying(externalHoverState);
      }
    }
  }, [externalHoverState, isMobile]);
  
  useEffect(() => {
    if (file) {
      logger.log(`VideoPreview [${componentId.current}]: Creating object URL for file: ${file.name}`);
      const fileUrl = URL.createObjectURL(file);
      setObjectUrl(fileUrl);
      
      return () => {
        if (fileUrl) {
          URL.revokeObjectURL(fileUrl);
        }
      };
    } else if (url && !isExternalLink) {
      logger.log(`VideoPreview [${componentId.current}]: Setting object URL from provided URL: ${url.substring(0, 30)}...`);
      setObjectUrl(url);
    }
  }, [file, url, isExternalLink]);

  const handleVideoError = (errorMessage: string) => {
    logger.error(`VideoPreview [${componentId.current}]: Error: ${errorMessage}`);
    setError(errorMessage);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    logger.log(`VideoPreview [${componentId.current}]: Retry requested`);
    setError(null);
    setIsPlaying(true);
  };

  const handleThumbnailGenerated = (thumbnailUrl: string) => {
    logger.log(`VideoPreview [${componentId.current}]: Thumbnail generated, current posterUrl: ${posterUrl ? 'exists' : 'none'}`);
    setThumbnailGenerationAttempts(prev => prev + 1);
    
    // Only update if we don't have a thumbnail yet or if we're forcing regeneration
    if (!posterUrl || forceGenerate) {
      logger.log(`VideoPreview [${componentId.current}]: Setting new thumbnail URL, attempt #${thumbnailGenerationAttempts + 1}`);
      setPosterUrl(thumbnailUrl);
      setThumbnailLoaded(true);
      // Prevent additional generation attempts after successful generation
      if (thumbnailGenerationAttempts === 0) {
        setForceGenerate(false);
      }
    } else {
      logger.log(`VideoPreview [${componentId.current}]: Ignoring new thumbnail because we already have one`);
    }
  };

  const handleMouseEnter = () => {
    if (externalHoverState === undefined) {
      logger.log(`VideoPreview [${componentId.current}]: Mouse entered`);
      setInternalHoverState(true);
      setIsHovering(true);
      // Only auto-play on hover for desktop
      if (!isMobile) {
        setIsPlaying(true);
      }
    }
  };

  const handleMouseLeave = () => {
    if (externalHoverState === undefined) {
      logger.log(`VideoPreview [${componentId.current}]: Mouse left`);
      setInternalHoverState(false);
      setIsHovering(false);
      setIsPlaying(false);
    }
  };

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  // Only generate thumbnail if we don't have one yet and haven't reached the max attempts
  const needsThumbnailGeneration = (!posterUrl || forceGenerate) && thumbnailGenerationAttempts < 2 && !thumbnailGeneratorMounted.current;
  
  if (needsThumbnailGeneration) {
    thumbnailGeneratorMounted.current = true;
  }

  // Important: Use pointer-events-none for the thumbnail if hovering to allow events to pass through
  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-hovering={effectiveHoverState ? "true" : "false"}
      data-is-mobile={isMobile ? "true" : "false"}
      data-component-id={componentId.current}
      data-thumbnail-loaded={thumbnailLoaded ? "true" : "false"}
    >
      {needsThumbnailGeneration && (
        <React.Fragment>
          {/* Fix: Don't render the logger.log call result directly */}
          <VideoThumbnailGenerator 
            file={file}
            url={url}
            onThumbnailGenerated={handleThumbnailGenerated}
            userId={user?.id}
            saveThumbnail={true}
            forceGenerate={forceGenerate}
          />
        </React.Fragment>
      )}
      
      {isExternalLink ? (
        <EmbeddedVideoPlayer 
          url={url || ''}
          isPlaying={isPlaying}
          posterUrl={posterUrl}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          isMobile={isMobile}
        />
      ) : file ? (
        <StandardVideoPreview 
          url={objectUrl}
          posterUrl={posterUrl}
          onError={handleVideoError}
          isHovering={effectiveHoverState}
          isMobile={isMobile}
        />
      ) : isBlobUrl ? (
        <StorageVideoPlayer
          videoLocation={url}
          controls={false}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={!isMobile}
          previewMode={true}
          showPlayButtonOnHover={!isMobile}
          autoPlay={!isMobile && effectiveHoverState}
          isHoveringExternally={effectiveHoverState}
          lazyLoad={false} 
          thumbnailUrl={thumbnailUrl || posterUrl}
          forcePreload={!isMobile} 
          isMobile={isMobile}
        />
      ) : url ? (
        <StorageVideoPlayer
          videoLocation={url}
          controls={false}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={!isMobile}
          previewMode={false}
          showPlayButtonOnHover={!isMobile}
          autoPlay={!isMobile && effectiveHoverState}
          isHoveringExternally={effectiveHoverState}
          lazyLoad={false}
          thumbnailUrl={thumbnailUrl || posterUrl}
          forcePreload={!isMobile}
          isMobile={isMobile}
        />
      ) : null}

      {error && <VideoPreviewError error={error} onRetry={handleRetry} videoSource={objectUrl || undefined} canRecover={false} />}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';

export default VideoPreview;
