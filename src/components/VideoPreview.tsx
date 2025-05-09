import React, { useState, useEffect, useRef, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import VideoThumbnailGenerator from './video/VideoThumbnailGenerator';
import VideoPreviewError from './video/VideoPreviewError';
import EmbeddedVideoPlayer from './video/EmbeddedVideoPlayer';
import StandardVideoPreview from './video/StandardVideoPreview';
import StorageVideoPlayer from './StorageVideoPlayer';
import { Logger } from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import VideoPlayer from './video/VideoPlayer';

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
  preventLoadingFlicker?: boolean;
  previewMode?: boolean;
  onLoadedData?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  shouldBePlaying?: boolean;
  onEnterPreloadArea?: (isInPreloadArea: boolean) => void;
  onError?: (message: string) => void;
  isMobile?: boolean;
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
  thumbnailUrl,
  preventLoadingFlicker = true,
  previewMode = false,
  onLoadedData,
  onVisibilityChange,
  shouldBePlaying = false,
  onEnterPreloadArea,
  onError,
  isMobile: propIsMobile,
}) => {
  const { user } = useAuth();
  const internalIsMobile = useIsMobile();
  const effectiveIsMobile = propIsMobile !== undefined ? propIsMobile : internalIsMobile;
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const isBlobUrl = url?.startsWith('blob:');
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(thumbnailUrl || null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [forceGenerate, setForceGenerate] = useState(!thumbnailUrl);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(!!thumbnailUrl);
  const componentId = useRef(`video_preview_${Math.random().toString(36).substring(2, 9)}`);
  const [thumbnailGenerationAttempts, setThumbnailGenerationAttempts] = useState(0);
  const thumbnailGeneratorMounted = useRef(false);
  const unmountedRef = useRef(false);
  
  useEffect(() => {
    logger.log(`VideoPreview mounting [${componentId.current}] URL: ${url ? url.substring(0, 30) + '...' : 'none'}`);
    logger.log(`Initial state [${componentId.current}]: thumbnailUrl: ${thumbnailUrl ? 'provided' : 'none'}, forceGenerate: ${forceGenerate}`);
    
    return () => {
      logger.log(`VideoPreview unmounting [${componentId.current}]`);
      unmountedRef.current = true;
      thumbnailGeneratorMounted.current = false;
    };
  }, []);
  
  const effectiveHoverState = externalHoverState || false;
  
  useEffect(() => {
    if (externalHoverState !== undefined && !unmountedRef.current) {
      if (!effectiveIsMobile) {
        setIsPlaying(externalHoverState);
      }
    }
  }, [externalHoverState, effectiveIsMobile]);
  
  useEffect(() => {
    if (file && !unmountedRef.current) {
      logger.log(`VideoPreview [${componentId.current}]: Creating object URL for file: ${file.name}`);
      const fileUrl = URL.createObjectURL(file);
      setObjectUrl(fileUrl);
      
      return () => {
        if (fileUrl) {
          URL.revokeObjectURL(fileUrl);
        }
      };
    } else if (url && !isExternalLink && !unmountedRef.current) {
      logger.log(`VideoPreview [${componentId.current}]: Setting object URL from provided URL: ${url.substring(0, 30)}...`);
      setObjectUrl(url);
    }
  }, [file, url, isExternalLink]);

  const handleVideoError = (errorMessage: string) => {
    if (unmountedRef.current) return;
    logger.error(`VideoPreview [${componentId.current}]: Error: ${errorMessage}`);
    setError(errorMessage);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    if (unmountedRef.current) return;
    logger.log(`VideoPreview [${componentId.current}]: Retry requested`);
    setError(null);
    setIsPlaying(true);
  };

  const handleThumbnailGenerated = (thumbnailUrl: string) => {
    if (unmountedRef.current) return;
    
    logger.log(`VideoPreview [${componentId.current}]: Thumbnail generated, current posterUrl: ${posterUrl ? 'exists' : 'none'}`);
    setThumbnailGenerationAttempts(prev => prev + 1);
    
    if (!posterUrl || forceGenerate) {
      logger.log(`VideoPreview [${componentId.current}]: Setting new thumbnail URL, attempt #${thumbnailGenerationAttempts + 1}`);
      setPosterUrl(thumbnailUrl);
      setThumbnailLoaded(true);
      if (thumbnailGenerationAttempts === 0) {
        setForceGenerate(false);
      }
    } else {
      logger.log(`VideoPreview [${componentId.current}]: Ignoring new thumbnail because we already have one`);
    }
  };

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  const needsThumbnailGeneration = (!posterUrl || forceGenerate) && thumbnailGenerationAttempts < 2 && !thumbnailGeneratorMounted.current;
  
  if (needsThumbnailGeneration) {
    thumbnailGeneratorMounted.current = true;
  }

  const videoOptions = {
    preloadVideo: true,
    skipTransitions: true,
    preventLoadingFlicker: true
  };

  // Determine if we should force preload based on context
  const shouldForcePreload = (!thumbnailUrl && !effectiveIsMobile) || (externalHoverState && !effectiveIsMobile) || (!lazyLoad && !previewMode);

  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
      data-hovering={effectiveHoverState ? "true" : "false"}
      data-is-mobile={effectiveIsMobile ? "true" : "false"}
      data-component-id={componentId.current}
      data-thumbnail-loaded={thumbnailLoaded ? "true" : "false"}
    >
      {needsThumbnailGeneration && (
        <VideoThumbnailGenerator 
          file={file}
          url={url}
          onThumbnailGenerated={handleThumbnailGenerated}
          userId={user?.id}
          saveThumbnail={true}
          forceGenerate={forceGenerate}
        />
      )}
      
      {isExternalLink ? (
        <EmbeddedVideoPlayer 
          url={url || ''}
          isPlaying={isPlaying}
          posterUrl={posterUrl}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          isMobile={effectiveIsMobile}
        />
      ) : file ? (
        <StandardVideoPreview 
          url={objectUrl}
          posterUrl={posterUrl}
          onError={handleVideoError}
          isHovering={effectiveHoverState}
          isMobile={effectiveIsMobile}
          preventLoadingFlicker={preventLoadingFlicker}
        />
      ) : isBlobUrl ? (
        <StorageVideoPlayer
          videoLocation={url}
          controls={false}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={true}
          previewMode={true}
          showPlayButtonOnHover={!effectiveIsMobile}
          autoPlay={effectiveHoverState}
          isHoveringExternally={effectiveHoverState}
          thumbnailUrl={thumbnailUrl || posterUrl}
          forcePreload={shouldForcePreload}
          isMobile={effectiveIsMobile}
          preventLoadingFlicker={preventLoadingFlicker}
          onLoadedData={onLoadedData}
          onVisibilityChange={onVisibilityChange}
          shouldBePlaying={shouldBePlaying}
          onEnterPreloadArea={onEnterPreloadArea}
          onError={onError}
        />
      ) : url ? (
        <StorageVideoPlayer
          videoLocation={url}
          controls={false}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={true}
          previewMode={previewMode}
          showPlayButtonOnHover={!effectiveIsMobile}
          autoPlay={effectiveHoverState}
          isHoveringExternally={effectiveHoverState}
          thumbnailUrl={thumbnailUrl || posterUrl}
          forcePreload={shouldForcePreload}
          isMobile={effectiveIsMobile}
          preventLoadingFlicker={preventLoadingFlicker}
          onLoadedData={onLoadedData}
          onVisibilityChange={onVisibilityChange}
          shouldBePlaying={shouldBePlaying}
          onEnterPreloadArea={onEnterPreloadArea}
          onError={onError}
        />
      ) : null}

      {error && <VideoPreviewError error={error} onRetry={handleRetry} videoSource={objectUrl || undefined} canRecover={false} />}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';

export default VideoPreview;
