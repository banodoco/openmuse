
import { useEffect, useRef } from 'react';
import { Logger } from '@/lib/logger';
import { attemptVideoPlay } from '@/lib/utils/videoUtils';

const logger = new Logger('useVideoPlayback');

interface UseVideoPlaybackProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  externallyControlled: boolean;
  isHovering: boolean;
  muted: boolean;
  isMobile: boolean;
  loadedDataFired: boolean;
  playAttempted: boolean;
  setPlayAttempted: (attempted: boolean) => void;
  forcedPlay?: boolean;
}

export const useVideoPlayback = ({
  videoRef,
  externallyControlled,
  isHovering,
  muted,
  isMobile,
  loadedDataFired,
  playAttempted,
  setPlayAttempted,
  forcedPlay = false
}: UseVideoPlaybackProps) => {
  const isHoveringRef = useRef(isHovering);

  useEffect(() => {
    isHoveringRef.current = isHovering;
  }, [isHovering]);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (externallyControlled) {
      logger.log(`External hover state: ${isHovering ? 'hovering' : 'not hovering'}`);
      
      if (isHovering) {
        logger.log('VideoPlayer: External hover detected - playing video');
        
        // For mobile in lightbox, we want to autoplay regardless
        const shouldAttemptPlay = (forcedPlay && isMobile) || (!playAttempted && video.readyState >= 2);
        
        if (shouldAttemptPlay) {
          setTimeout(() => {
            if (video) {
              attemptVideoPlay(video, muted)
                .then(() => logger.log('Play succeeded on hover or forced play'))
                .catch(e => logger.error('Play failed on hover or forced play:', e));
              setPlayAttempted(true);
            }
          }, 100);
        }
      } else if (!isHovering && !video.paused) {
        logger.log('VideoPlayer: External hover ended - pausing video');
        video.pause();
      }
    }
  }, [isHovering, externallyControlled, videoRef, muted, isMobile, playAttempted, setPlayAttempted, forcedPlay]);
};
