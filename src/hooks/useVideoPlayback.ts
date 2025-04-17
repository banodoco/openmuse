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
  setPlayAttempted: React.Dispatch<React.SetStateAction<boolean>>;
  forcedPlay: boolean;
  componentId?: string;
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
  forcedPlay,
  componentId
}: UseVideoPlaybackProps) => {
  const isHoveringRef = useRef(isHovering);
  const hasPlayedOnceRef = useRef(false);
  const unmountedRef = useRef(false);
  const logPrefix = componentId ? `[${componentId}] ` : '';

  useEffect(() => {
    logger.log(`${logPrefix}useVideoPlayback mount effect ran.`);
    return () => {
      logger.log(`${logPrefix}useVideoPlayback unmounting.`);
      isHoveringRef.current = false;
      unmountedRef.current = true;
    };
  }, [componentId]);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (externallyControlled) {
      logger.log(`${logPrefix}External hover state: ${isHovering ? 'hovering' : 'not hovering'}`);
      
      if (isHovering) {
        logger.log(`${logPrefix}VideoPlayer: External hover detected - playing video`);
        
        // For mobile in lightbox, we want to autoplay regardless
        const shouldAttemptPlay = (forcedPlay && isMobile) || (!playAttempted && video.readyState >= 2);
        
        if (shouldAttemptPlay) {
          setTimeout(() => {
            if (video && !unmountedRef.current) {
              attemptVideoPlay(video, muted)
                .then(() => logger.log(`${logPrefix}Play succeeded on hover or forced play`))
                .catch(e => logger.error(`${logPrefix}Play failed on hover or forced play:`, e));
              setPlayAttempted(true);
            }
          }, 100);
        }
      } else if (!isHovering && !video.paused) {
        logger.log(`${logPrefix}VideoPlayer: External hover ended - pausing video`);
        video.pause();
      }
    }
  }, [isHovering, externallyControlled, videoRef, muted, isMobile, playAttempted, setPlayAttempted, forcedPlay, componentId]);

  const resetVideo = () => {
    if (videoRef.current && !unmountedRef.current) {
      logger.log(`${logPrefix}Resetting video currentTime to 0.`);
      videoRef.current.currentTime = 0;
      hasPlayedOnceRef.current = false; // Allow replay after reset
    }
  };

  return { resetVideo };
};
