
import { useEffect, RefObject } from 'react';
import { Logger } from '@/lib/logger';

const logger = new Logger('useVideoHover');

/**
 * Hook to handle playing videos on hover and pausing when mouse leaves
 */
export const useVideoHover = (
  containerRef: RefObject<HTMLElement>,
  videoRef: RefObject<HTMLVideoElement>,
  options: {
    enabled: boolean;
    resetOnLeave?: boolean;
  }
) => {
  const { enabled, resetOnLeave = true } = options;

  useEffect(() => {
    if (!enabled) return;
    
    const container = containerRef.current;
    const video = videoRef.current;
    
    if (!container || !video) {
      logger.warn('Container or video ref not available for hover effect');
      return;
    }
    
    const handleMouseEnter = () => {
      logger.log('useVideoHover: Mouse entered video container');
      if (video.paused) {
        logger.log('useVideoHover: Attempting to play video on hover');
        video.play().catch(e => {
          logger.warn('useVideoHover: Play on hover prevented:', e);
        });
      }
    };
    
    const handleMouseLeave = () => {
      logger.log('useVideoHover: Mouse left video container');
      if (!video.paused) {
        logger.log('useVideoHover: Pausing video');
        video.pause();
        
        if (resetOnLeave) {
          // Reset to the beginning for a consistent preview
          logger.log('useVideoHover: Resetting video to beginning');
          video.currentTime = 0;
        }
      }
    };
    
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, videoRef, enabled, resetOnLeave]);
};
