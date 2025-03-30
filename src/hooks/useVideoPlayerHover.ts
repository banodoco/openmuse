
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
  isMobile?: boolean;
}

export function useVideoPlayerHover({
  isHoveringExternally,
  videoRef,
  videoInitialized,
  videoLoaded,
  previewMode = false,
  onLoadRequest,
  isMobile = false
}: UseVideoPlayerHoverProps) {
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const isHoveringRef = useRef(isHoveringExternally || false);
  
  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined && !isMobile) {
      logger.log('StorageVideoPlayer: Manual hover start');
      setIsHovering(true);
      if (onLoadRequest) onLoadRequest();
    }
  };

  const handleManualHoverEnd = () => {
    if (isHoveringExternally === undefined && !isMobile) {
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
      if (isHoveringExternally && !isMobile) {  // Don't auto-load on mobile
        logger.log('External hover detected - loading video');
        if (onLoadRequest) onLoadRequest();
      }
      
      if (videoInitialized && videoRef.current) {
        const video = videoRef.current;
        
        // On mobile, don't auto-play
        if ((isHoveringExternally && !isMobile) && video.paused && videoLoaded) {
          logger.log(`External hover detected - attempting to play video`);
          
          setTimeout(() => {
            if (video.paused) {
              video.play().catch(e => {
                if (e.name !== 'AbortError') {
                  logger.error('Error playing video on hover:', e);
                }
              });
            }
          }, 0);
        } else if (!isHoveringExternally && !video.paused && !isMobile) {
          // Only pause if not on mobile
          logger.log('External hover ended - pausing video');
          video.pause();
          if (previewMode) {
            video.currentTime = 0;
          }
        }
      }
    }
  }, [isHoveringExternally, previewMode, videoRef, videoInitialized, videoLoaded, onLoadRequest, isMobile]);
  
  return {
    isHovering: isHovering, // Changed from always true on mobile to respect the actual hovering state
    handleManualHoverStart,
    handleManualHoverEnd
  };
}
