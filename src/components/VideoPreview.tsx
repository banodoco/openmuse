
import React from 'react';
import VideoPreviewCore from './video/preview/VideoPreviewCore';

interface VideoPreviewProps {
  file?: File;
  url?: string;
  className?: string;
  title?: string;
  creator?: string;
  isHovering?: boolean;
  lazyLoad?: boolean;
  thumbnailUrl?: string;
  onTouch?: () => void;
  isMobile?: boolean;
  showPlayButton?: boolean;
  forceFrameCapture?: boolean;
  captureTimeout?: number;
  fallbackToVideo?: boolean;
}

/**
 * VideoPreview component for displaying video previews with thumbnail generation
 * and play on hover functionality.
 */
const VideoPreview: React.FC<VideoPreviewProps> = (props) => {
  return <VideoPreviewCore {...props} />;
};

VideoPreview.displayName = 'VideoPreview';

export default VideoPreview;
