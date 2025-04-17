
import { useEffect, useRef, RefObject } from 'react';
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
    delayPlay?: number;
    preloadOnHover?: boolean;
    preventLoadingUI?: boolean;
  }
) => {
  const { enabled, resetOnLeave = true, delayPlay = 0, preloadOnHover = true, preventLoadingUI = true } = options;
  const playTimeoutRef = useRef<number | null>(null);
  const isHoveringRef = useRef<boolean>(false);
  const lastPlayAttemptRef = useRef<number>(0);
  const videoReadyRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    
    const container = containerRef.current;
    const video = videoRef.current;
    
    if (!container || !video) {
      logger.warn('Container or video ref not available for hover effect');
      return;
    }
    
    // Track when the video is loaded and ready to play
    const handleCanPlay = () => {
      videoReadyRef.current = true;
      logger.log('Video is loaded and ready to play on hover');
    };
    
    const handleMouseEnter = () => {
      logger.log('Mouse entered video container');
      isHoveringRef.current = true;
      
      // Always ensure video is ready to play by setting preload to auto
      if (preloadOnHover && video.preload !== 'auto') {
        video.preload = 'auto';
      }
      
      // Clear any existing timeout
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
      }
      
      // Start playing after delay (or immediately if delay is 0)
      playTimeoutRef.current = window.setTimeout(() => {
        // Check if we're still hovering (mouse might have left during timeout)
        if (!isHoveringRef.current) return;
        
        // Only attempt to play if video is paused
        if (video.paused) {
          logger.log('Attempting to play video on hover');
          
          // Always start from the beginning for a consistent preview
          video.currentTime = 0;
          
          // Track when we try to play to avoid too many rapid attempts
          const now = Date.now();
          lastPlayAttemptRef.current = now;
          
          // Use a more direct play approach
          video.play().catch(e => {
            // Only log errors that aren't abort errors (which happen when quickly hovering in/out)
            if (e.name !== 'AbortError') {
              logger.warn('Play on hover prevented:', e);
            }
          });
        }
      }, delayPlay);
    };
    
    const handleMouseLeave = () => {
      logger.log('Mouse left video container');
      isHoveringRef.current = false;
      
      // Clear any pending play operation
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
      
      // Remove delay and pause immediately
      if (!video.paused) {
        video.pause();
        
        if (resetOnLeave) {
          // Reset to the beginning for a consistent preview
          video.currentTime = 0;
        }
      }
    };
    
    // Add canplay event to track when the video is ready
    video.addEventListener('canplay', handleCanPlay);
    
    // Remove any existing listeners before adding new ones
    container.removeEventListener('mouseenter', handleMouseEnter);
    container.removeEventListener('mouseleave', handleMouseLeave);
    
    // Add listeners
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      // Clear any pending timeout on unmount
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
      }
      
      // Clean up event listeners
      if (video) {
        video.removeEventListener('canplay', handleCanPlay);
      }
      
      if (container) {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [containerRef, videoRef, enabled, resetOnLeave, delayPlay, preloadOnHover, preventLoadingUI]);
  
  return {
    isHovering: isHoveringRef.current,
    videoReady: videoReadyRef.current
  };
};
