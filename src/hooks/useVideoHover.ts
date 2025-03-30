
import { useEffect, useRef, RefObject } from 'react';
import { Logger } from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-mobile';

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
    isMobile?: boolean; // Flag to handle mobile behavior differently
  }
) => {
  const { enabled, resetOnLeave = true, delayPlay = 0, isMobile: propIsMobile } = options;
  const defaultIsMobile = useIsMobile();
  const isMobile = propIsMobile !== undefined ? propIsMobile : defaultIsMobile;
  
  const playTimeoutRef = useRef<number | null>(null);
  const isHoveringRef = useRef<boolean>(false);
  const lastPlayAttemptRef = useRef<number>(0);
  const touchPlayToggleRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    
    const container = containerRef.current;
    const video = videoRef.current;
    
    if (!container || !video) {
      logger.warn('Container or video ref not available for hover effect');
      return;
    }
    
    const handleMouseEnter = () => {
      if (isMobile) return; // Skip hover handling on mobile
      
      logger.log('Mouse entered video container');
      isHoveringRef.current = true;
      
      // Clear any existing timeout
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
      }
      
      playTimeoutRef.current = window.setTimeout(() => {
        // Check if we're still hovering (mouse might have left during timeout)
        if (!isHoveringRef.current) return;
        
        // Ensure video is ready and not already playing
        if (video.paused) {
          logger.log('Attempting to play video on hover');
          
          // Force preload if not already loaded
          if (video.preload !== 'auto') {
            video.preload = 'auto';
          }
          
          // Always start from the beginning for a consistent preview
          video.currentTime = 0;
          
          // Track when we try to play to avoid too many rapid attempts
          const now = Date.now();
          lastPlayAttemptRef.current = now;
          
          // Try to play the video
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
      if (isMobile) return; // Skip hover handling on mobile
      
      logger.log('Mouse left video container');
      isHoveringRef.current = false;
      
      // Clear any pending play operation
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
      
      // Pause immediately
      if (!video.paused) {
        video.pause();
        
        if (resetOnLeave) {
          // Reset to the beginning for a consistent preview
          video.currentTime = 0;
        }
      }
    };
    
    // For mobile: now we just show the thumbnail on index page
    // and let the card click navigate to details
    const handleTouch = (e: TouchEvent) => {
      if (!isMobile) return;
      
      // We don't handle the touch event here anymore
      // Let the parent card handle the navigation
      logger.log('Touch event on video, passing through to container');
    };
    
    // Remove any existing listeners before adding new ones
    container.removeEventListener('mouseenter', handleMouseEnter);
    container.removeEventListener('mouseleave', handleMouseLeave);
    container.removeEventListener('touchstart', handleTouch as EventListener);
    
    // Add listeners
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    // Only add touch listener for mobile if needed for specific cases
    if (isMobile) {
      container.addEventListener('touchstart', handleTouch as EventListener, { passive: true });
    }
    
    return () => {
      // Clear any pending timeout on unmount
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
      }
      
      // Clean up event listeners
      if (container) {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('touchstart', handleTouch as EventListener);
      }
    };
  }, [containerRef, videoRef, enabled, resetOnLeave, delayPlay, isMobile]);
};
