
import { useState, useEffect, useRef } from 'react';
import { Logger } from '@/lib/logger';

const logger = new Logger('useVideoPlayerHover');

interface UseVideoPlayerHoverProps {
  isHoveringExternally?: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoInitialized: boolean;
  videoLoaded: boolean;
  previewMode?: boolean;
  onLoadRequest?: () => void;
}

export function useVideoPlayerHover({
  isHoveringExternally,
  videoRef,
  videoInitialized,
  videoLoaded,
  previewMode = false,
  onLoadRequest
}: UseVideoPlayerHoverProps) {
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const isHoveringRef = useRef(isHoveringExternally || false);
  
  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined) {
      logger.log('StorageVideoPlayer: Manual hover start');
      setIsHovering(true);
      if (onLoadRequest) onLoadRequest();
    }
  };

  const handleManualHoverEnd = () => {
    if (isHoveringExternally === undefined) {
      logger.log('StorageVideoPlayer: Manual hover end');
      setIsHovering(false);
    }
  };
  
  useEffect(() => {
    isHoveringRef.current = isHoveringExternally || false;
    if (isHoveringExternally !== undefined) {
      logger.log(`StorageVideoPlayer: isHoveringExternally changed to ${isHoveringExternally}`);
      setIsHovering(isHoveringExternally);
    }
  }, [isHoveringExternally]);
  
  useEffect(() => {
    if (isHoveringExternally !== undefined) {
      if (isHoveringExternally) {
        logger.log('External hover detected - loading video');
        if (onLoadRequest) onLoadRequest();
      }
      
      if (videoInitialized && videoRef.current) {
        const video = videoRef.current;
        
        if (isHoveringExternally && video.paused && videoLoaded) {
          logger.log('External hover detected - attempting to play video');
          
          setTimeout(() => {
            if (video.paused) {
              video.play().catch(e => {
                if (e.name !== 'AbortError') {
                  logger.error('Error playing video on hover:', e);
                }
              });
            }
          }, 0);
        } else if (!isHoveringExternally && !video.paused) {
          logger.log('External hover ended - pausing video');
          video.pause();
          if (previewMode) {
            video.currentTime = 0;
          }
        }
      }
    }
  }, [isHoveringExternally, previewMode, videoRef, videoInitialized, videoLoaded, onLoadRequest]);
  
  return {
    isHovering,
    handleManualHoverStart,
    handleManualHoverEnd
  };
}
