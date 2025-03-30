
import React, { useState, useEffect, useRef, memo } from 'react';
import { Logger } from '@/lib/logger';
import { useVideoUrl } from '@/hooks/useVideoUrl';
import { useVideoPlayerHover } from '@/hooks/useVideoPlayerHover';
import StorageVideoContainer from './video/StorageVideoContainer';
import { useIsMobile } from '@/hooks/use-mobile';

const logger = new Logger('StorageVideoPlayer');

interface StorageVideoPlayerProps {
  videoLocation: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playOnHover?: boolean;
  previewMode?: boolean;
  showPlayButtonOnHover?: boolean;
  isHoveringExternally?: boolean;
  lazyLoad?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onLoadedData?: () => void;
  thumbnailUrl?: string;
  forcePreload?: boolean;
  forceThumbnailGeneration?: boolean;
  captureTimeout?: number;
  fallbackToVideo?: boolean;
  isMobile?: boolean;
}

const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
  videoLocation,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  playOnHover = false,
  previewMode = false,
  showPlayButtonOnHover = true,
  isHoveringExternally,
  lazyLoad = true,
  videoRef: externalVideoRef,
  onLoadedData,
  thumbnailUrl,
  forcePreload = false,
  forceThumbnailGeneration = false,
  captureTimeout = 5000,
  fallbackToVideo = false,
  isMobile: externalIsMobile
}) => {
  const [videoInitialized, setVideoInitialized] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(thumbnailUrl || null);
  const [needsThumbnailGeneration, setNeedsThumbnailGeneration] = useState(forceThumbnailGeneration && !thumbnailUrl);
  const { userId } = useRef({ userId: null }).current;
  const defaultIsMobile = useIsMobile();
  const isMobile = externalIsMobile !== undefined ? externalIsMobile : defaultIsMobile;

  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  
  const isBlobUrl = videoLocation.startsWith('blob:');

  // Custom hooks
  const { 
    videoUrl, 
    loading, 
    error, 
    errorDetails, 
    shouldLoadVideo,
    videoLoaded,
    setVideoLoaded,
    handleRetry,
    triggerLoad
  } = useVideoUrl({
    videoLocation,
    previewMode,
    isBlobUrl,
    forcePreload,
    lazyLoad,
    isMobile
  });

  const {
    isHovering,
    handleManualHoverStart,
    handleManualHoverEnd
  } = useVideoPlayerHover({
    isHoveringExternally,
    videoRef,
    videoInitialized,
    videoLoaded,
    previewMode,
    onLoadRequest: triggerLoad,
    isMobile
  });

  useEffect(() => {
    setNeedsThumbnailGeneration(forceThumbnailGeneration && !thumbnailUrl && !posterUrl);
  }, [forceThumbnailGeneration, thumbnailUrl, posterUrl]);

  const handleThumbnailGenerated = (url: string) => {
    logger.log('StorageVideoPlayer: Thumbnail generated from direct video capture');
    setPosterUrl(url);
    setNeedsThumbnailGeneration(false);
  };

  const handleVideoLoaded = () => {
    setVideoInitialized(true);
    if (onLoadedData) {
      logger.log('StorageVideoPlayer: Video loaded, notifying parent');
      onLoadedData();
    }
  };

  return (
    <div 
      className="relative w-full h-full"
      onMouseEnter={handleManualHoverStart}
      onMouseLeave={handleManualHoverEnd}
      ref={containerRef}
    >
      <StorageVideoContainer
        videoUrl={videoUrl}
        error={error}
        errorDetails={errorDetails}
        loading={loading}
        shouldLoadVideo={shouldLoadVideo}
        posterUrl={posterUrl}
        isHovering={isHovering}
        needsThumbnailGeneration={needsThumbnailGeneration}
        videoLocation={videoLocation}
        videoRef={videoRef}
        containerRef={containerRef}
        videoInitialized={videoInitialized}
        onThumbGenerated={handleThumbnailGenerated}
        onRetry={handleRetry}
        onVideoLoaded={handleVideoLoaded}
        userId={userId}
        className={className}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playOnHover={playOnHover}
        previewMode={previewMode}
        showPlayButtonOnHover={showPlayButtonOnHover}
        isHoveringExternally={isHoveringExternally}
        captureTimeout={captureTimeout}
        isMobile={isMobile}
        lazyLoad={lazyLoad}
      />
    </div>
  );
});

StorageVideoPlayer.displayName = 'StorageVideoPlayer';

export default StorageVideoPlayer;
