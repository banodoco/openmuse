
import React, { useState, useRef } from 'react';
import { Logger } from '@/lib/logger';
import VideoPreviewThumbnail from './VideoPreviewThumbnail';
import VideoPreviewContent from './VideoPreviewContent';
import { useVideoPreviewState } from './useVideoPreviewState';

const logger = new Logger('VideoPreviewCore');

interface VideoPreviewCoreProps {
  file?: File;
  url?: string;
  className?: string;
  title?: string;
  creator?: string;
  isHovering?: boolean;
  lazyLoad?: boolean;
  thumbnailUrl?: string | null;
  onTouch?: () => void;
  isMobile?: boolean;
  showPlayButton?: boolean;
  forceFrameCapture?: boolean;
  captureTimeout?: number;
  fallbackToVideo?: boolean;
}

const VideoPreviewCore: React.FC<VideoPreviewCoreProps> = ({
  file, 
  url, 
  className,
  title,
  creator,
  isHovering: externalHoverState,
  lazyLoad = true,
  thumbnailUrl,
  onTouch,
  isMobile: externalIsMobile,
  showPlayButton = true,
  forceFrameCapture = false,
  captureTimeout = 5000,
  fallbackToVideo = false
}) => {
  const previewRef = useRef<HTMLDivElement>(null);
  
  const {
    objectUrl,
    isExternalLink,
    isBlobUrl,
    error,
    posterUrl,
    effectiveHoverState,
    isPlaying,
    thumbnailGenerationAttempted,
    thumbnailGenerationFailed,
    needsThumbnailGeneration,
    handleVideoError,
    handleRetry,
    handleThumbnailGenerated,
    handleThumbnailError,
    handleMouseEnter,
    handleMouseLeave,
    handleTouchEvent
  } = useVideoPreviewState({
    file,
    url,
    externalHoverState,
    lazyLoad,
    thumbnailUrl,
    forceFrameCapture,
    captureTimeout,
    fallbackToVideo,
    onTouch,
    externalIsMobile
  });

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
      onMouseEnter={externalIsMobile ? undefined : handleMouseEnter}
      onMouseLeave={externalIsMobile ? undefined : handleMouseLeave}
      onTouchStart={handleTouchEvent}
      data-hovering={effectiveHoverState ? "true" : "false"}
      data-mobile={externalIsMobile ? "true" : "false"}
      data-has-thumbnail={!!posterUrl && posterUrl !== '/placeholder.svg' ? "true" : "false"}
      data-thumbnail-failed={thumbnailGenerationFailed ? "true" : "false"}
    >
      <VideoPreviewContent 
        isExternalLink={isExternalLink}
        url={url}
        objectUrl={objectUrl}
        isBlobUrl={isBlobUrl}
        file={file}
        error={error}
        posterUrl={posterUrl}
        effectiveHoverState={effectiveHoverState}
        isPlaying={isPlaying}
        externalIsMobile={externalIsMobile}
        thumbnailGenerationAttempted={thumbnailGenerationAttempted}
        thumbnailGenerationFailed={thumbnailGenerationFailed}
        needsThumbnailGeneration={needsThumbnailGeneration}
        showPlayButton={showPlayButton}
        lazyLoad={lazyLoad}
        forceFrameCapture={forceFrameCapture}
        captureTimeout={captureTimeout}
        fallbackToVideo={fallbackToVideo}
        title={title}
        creator={creator}
        onVideoError={handleVideoError}
        onRetry={handleRetry}
        onThumbnailGenerated={handleThumbnailGenerated}
        onThumbnailError={handleThumbnailError}
      />
    </div>
  );
};

export default VideoPreviewCore;
