
import React from 'react';
import { Logger } from '@/lib/logger';
import VideoPlayer from './VideoPlayer';
import VideoPreviewError from './VideoPreviewError';
import VideoThumbnailGenerator from './VideoThumbnailGenerator';
import PlayButtonOverlay from './PlayButtonOverlay';

const logger = new Logger('StorageVideoContainer');

interface StorageVideoContainerProps {
  videoUrl: string;
  error: string | null;
  errorDetails: string | null;
  loading: boolean;
  shouldLoadVideo: boolean;
  posterUrl: string | null;
  isHovering: boolean;
  needsThumbnailGeneration: boolean;
  videoLocation: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  videoInitialized: boolean;
  onThumbGenerated: (url: string) => void;
  onRetry: () => void;
  onVideoLoaded: () => void;
  userId?: string | null;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playOnHover?: boolean;
  previewMode?: boolean;
  showPlayButtonOnHover?: boolean;
  isHoveringExternally?: boolean;
  captureTimeout?: number;
  isMobile?: boolean;
  lazyLoad?: boolean;
}

const StorageVideoContainer: React.FC<StorageVideoContainerProps> = ({
  videoUrl,
  error,
  errorDetails,
  loading,
  shouldLoadVideo,
  posterUrl,
  isHovering,
  needsThumbnailGeneration,
  videoLocation,
  videoRef,
  containerRef,
  videoInitialized,
  onThumbGenerated,
  onRetry,
  onVideoLoaded,
  userId,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  playOnHover = false,
  previewMode = false,
  showPlayButtonOnHover = true,
  isHoveringExternally,
  captureTimeout,
  isMobile = false,
  lazyLoad = true
}) => {
  return (
    <>
      {loading && shouldLoadVideo && !posterUrl && (
        <div className="flex items-center justify-center h-full bg-secondary/30 rounded-lg">
          <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="relative h-full w-full bg-secondary/30 rounded-lg">
          <VideoPreviewError 
            error={error} 
            details={errorDetails || undefined}
            onRetry={onRetry} 
            videoSource={videoUrl}
            canRecover={!previewMode}
          />
        </div>
      )}

      {/* Generate thumbnail directly from the video if needed */}
      {needsThumbnailGeneration && videoLocation && !loading && (
        <VideoThumbnailGenerator
          url={videoLocation}
          onThumbnailGenerated={onThumbGenerated}
          userId={userId}
          saveThumbnail={true}
          forceCapture={true}
          timeout={captureTimeout}
        />
      )}

      {/* If we have a thumbnail, always show it */}
      {posterUrl && (
        <img 
          src={posterUrl} 
          alt="Video thumbnail" 
          className="w-full h-full object-cover absolute inset-0 z-0"
        />
      )}

      {!error && videoUrl && shouldLoadVideo && (
        <div className={posterUrl && !isMobile ? "opacity-0 hover:opacity-100 transition-opacity duration-300" : ""}>
          <VideoPlayer
            src={videoUrl}
            className={className}
            controls={controls}
            autoPlay={autoPlay || isHovering || isMobile}
            muted={muted}
            loop={loop}
            playOnHover={playOnHover && !isMobile}
            onError={(message) => logger.error(message)}
            showPlayButtonOnHover={showPlayButtonOnHover && !isMobile}
            containerRef={containerRef}
            videoRef={videoRef}
            externallyControlled={isHoveringExternally !== undefined || isMobile}
            isHovering={isHovering || isMobile}
            poster={posterUrl || undefined}
            lazyLoad={lazyLoad && !isMobile}
            onLoadedData={onVideoLoaded}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* Only show play button if explicitly requested and not on mobile */}
      <PlayButtonOverlay 
        visible={!!posterUrl && !isHovering && showPlayButtonOnHover && !previewMode && !isMobile} 
        previewMode={previewMode}
      />
    </>
  );
};

export default StorageVideoContainer;
