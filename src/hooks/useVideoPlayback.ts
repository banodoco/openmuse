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
  const logPrefix = componentId ? `[VideoHoverPlayDebug] [${componentId}] ` : '[VideoHoverPlayDebug] [UnknownComponent] ';

  useEffect(() => {
    isHoveringRef.current = isHovering;
    logger.log(`${logPrefix}isHovering prop changed to: ${isHovering}. ExternallyControlled: ${externallyControlled}`);
  }, [isHovering, externallyControlled, logPrefix]);

  useEffect(() => {
    logger.log(`${logPrefix}useVideoPlayback mount effect ran. Initial props: externallyControlled=${externallyControlled}, isHovering=${isHovering}, muted=${muted}, isMobile=${isMobile}, loadedDataFired=${loadedDataFired}, playAttempted=${playAttempted}, forcedPlay=${forcedPlay}`);
    return () => {
      logger.log(`${logPrefix}useVideoPlayback unmounting.`);
      isHoveringRef.current = false;
      unmountedRef.current = true;
    };
  }, [componentId]);
  
  useEffect(() => {
    const video = videoRef.current;
    logger.log(`${logPrefix}Playback effect triggered. ExternallyControlled: ${externallyControlled}, IsHovering (prop): ${isHovering}, IsHovering (ref): ${isHoveringRef.current}, VideoPaused: ${video?.paused}, LoadedDataFired: ${loadedDataFired}, PlayAttempted: ${playAttempted}, ForcedPlay: ${forcedPlay}, Muted: ${muted}, IsMobile: ${isMobile}, VideoSrc: ${video?.src?.substring(0,30)}`);

    if (!video || unmountedRef.current) {
      logger.log(`${logPrefix}Playback effect: No video element or component unmounted. Aborting. Video: ${!!video}, Unmounted: ${unmountedRef.current}`);
      return;
    }
    
    if (externallyControlled) {
      logger.log(`${logPrefix}Externally controlled. Current isHovering (prop): ${isHovering}`);
      
      if (isHovering) {
        const shouldAttemptPlayExternal = (forcedPlay && isMobile) || 
                                      (!playAttempted && video.readyState >= 1) || 
                                      (video.paused && playAttempted);

        logger.log(`${logPrefix}External hover detected. ShouldAttemptPlayExternal: ${shouldAttemptPlayExternal}. ForcedPlay: ${forcedPlay}, IsMobile: ${isMobile}, PlayAttempted: ${playAttempted}, VideoReadyState: ${video.readyState}, VideoPaused: ${video.paused}`);
        
        if (shouldAttemptPlayExternal) {
          logger.log(`${logPrefix}Attempting play IMMEDIATELY due to external hover/forced play. Muted: ${muted}. Video src: ${video.src?.substring(0,30)}`);
          if (videoRef.current && !unmountedRef.current && isHoveringRef.current) {
            attemptVideoPlay(videoRef.current, muted)
              .then(() => {
                logger.log(`${logPrefix}Play SUCCEEDED via attemptVideoPlay (external hover/forced).`);
                if (!unmountedRef.current) setPlayAttempted(true);
                hasPlayedOnceRef.current = true;
              })
              .catch(e => {
                logger.error(`${logPrefix}Play FAILED via attemptVideoPlay (external hover/forced):`, e);
              });
          } else {
            logger.log(`${logPrefix}Play attempt aborted (video gone, unmounted, or somehow no longer hovering immediately). HoverState: ${isHoveringRef.current}`);
          }
        }
      } else if (!isHovering && !video.paused) {
        logger.log(`${logPrefix}External hover ended - pausing video. Video src: ${video.src?.substring(0,30)}`);
        video.pause();
      }
    } else {
      logger.log(`${logPrefix}NOT externally controlled. isHovering (prop) is ${isHovering}. This hook currently relies on VideoPlayer's primary play logic or direct calls for non-external control.`);
    }
  }, [videoRef, externallyControlled, isHovering, muted, isMobile, loadedDataFired, playAttempted, setPlayAttempted, forcedPlay, componentId, logPrefix]);

  const resetVideo = () => {
    if (videoRef.current && !unmountedRef.current) {
      logger.log(`${logPrefix}Resetting video currentTime to 0.`);
      videoRef.current.currentTime = 0;
      hasPlayedOnceRef.current = false;
    }
  };

  return { resetVideo };
};
