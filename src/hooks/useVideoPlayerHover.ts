
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
    // No video playback effects on mobile at all
    if (isMobile) {
      return;
    }
    
    if (isHoveringExternally !== undefined) {
      // Only attempt to load on hover (not mobile)
      if (isHoveringExternally && !isMobile) {
        logger.log('External hover detected - loading video');
        if (onLoadRequest) onLoadRequest();
      }
      
      if (videoInitialized && videoRef.current) {
        const video = videoRef.current;
        
        // Only play on hover for desktop
        if ((isHoveringExternally && !isMobile) && video.paused && videoLoaded) {
          logger.log(`External hover detected - attempting to play video`);
          
          setTimeout(() => {
            if (video && !video.paused) {
              // Video is already playing, do nothing
              return;
            }
            
            if (video && video.paused && !isMobile) {
              video.play().catch(e => {
                if (e.name !== 'AbortError') {
                  logger.error('Error playing video on hover:', e);
                }
              });
            }
          }, 0);
        } else if (!isHoveringExternally && !video.paused) {
          // Pause when not hovering
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
    isHovering: isMobile ? false : isHovering, // Always return false for mobile
    handleManualHoverStart,
    handleManualHoverEnd
  };
}
