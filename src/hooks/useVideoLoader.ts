import { useState, useEffect, useRef } from 'react';
import { Logger } from '@/lib/logger';
import { getVideoErrorMessage, isValidVideoUrl, getVideoFormat, attemptVideoPlay } from '@/lib/utils/videoUtils';

const logger = new Logger('useVideoLoader');

interface UseVideoLoaderProps {
  src: string;
  poster?: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  onError?: (message: string) => void;
  onLoadedData?: (event: Event) => void;
  autoPlay?: boolean;
  muted?: boolean;
  playOnHover?: boolean;
  externallyControlled?: boolean;
  isHovering?: boolean;
  isMobile?: boolean;
}

export const useVideoLoader = ({
  src,
  poster,
  videoRef,
  onError,
  onLoadedData,
  autoPlay = false,
  muted = true,
  playOnHover = false,
  externallyControlled = false,
  isHovering = false,
  isMobile = false
}: UseVideoLoaderProps) => {
  const componentId = videoRef.current?.id || 'unknown_video_id'; // Attempt to get an ID
  logger.log(`[VideoHoverPlayDebug] [${componentId}] useVideoLoader init. src: ${src?.substring(0,30)}, autoPlay: ${autoPlay}, playOnHover: ${playOnHover}, externallyControlled: ${externallyControlled}, isHovering: ${isHovering}, isMobile: ${isMobile}`);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [isBlobUrl, setIsBlobUrl] = useState<boolean>(src?.startsWith('blob:') || false);
  const [playAttempted, setPlayAttempted] = useState(false);
  const [loadedDataFired, setLoadedDataFired] = useState(false);
  const prevSrcRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    const currentComponentId = videoRef.current?.id || 'unknown_video_id';
    logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] playAttempted state changed to: ${playAttempted}. src: ${src?.substring(0,30)}`);
  }, [playAttempted, src, videoRef]);

  useEffect(() => {
    const currentComponentId = videoRef.current?.id || 'unknown_video_id';
    logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] isLoading state changed to: ${isLoading}. src: ${src?.substring(0,30)}`);
  }, [isLoading, src, videoRef]);

  useEffect(() => {
    const currentComponentId = videoRef.current?.id || 'unknown_video_id';
    logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] loadedDataFired state changed to: ${loadedDataFired}. src: ${src?.substring(0,30)}`);
  }, [loadedDataFired, src, videoRef]);

  useEffect(() => {
    setIsBlobUrl(src?.startsWith('blob:') || false);
    const currentComponentId = videoRef.current?.id || 'unknown_video_id';
    
    if (!src) {
      logger.error(`[VideoHoverPlayDebug] [${currentComponentId}] No source provided.`);
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
      return;
    }
    
    if (!isBlobUrl && !isValidVideoUrl(src)) {
      const format = getVideoFormat(src);
      const errorMsg = `Invalid video source: ${src.substring(0, 50)}...`;
      logger.error(`[VideoHoverPlayDebug] [${currentComponentId}] ${errorMsg}`);
      setError(`The video URL appears to be invalid or inaccessible`);
      setErrorDetails(`Source doesn't appear to be a playable video URL. Format detected: ${format}`);
      setIsLoading(false);
      if (onError) onError(errorMsg);
    }
  }, [src, onError, isBlobUrl, videoRef]);
  
  useEffect(() => {
    const currentComponentId = videoRef.current?.id || 'unknown_video_id';
    logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] Main loader effect run. Current src: ${src?.substring(0,30)}, Prev src: ${prevSrcRef.current?.substring(0,30)}`);

    if (!videoRef) {
      logger.error(`[VideoHoverPlayDebug] [${currentComponentId}] videoRef object itself is null or undefined.`);
      setError('Internal error: Video reference handler missing.');
      setIsLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!src || !video) {
      if (!src) {
        logger.error(`[VideoHoverPlayDebug] [${currentComponentId}] No source provided in main effect.`);
        setError('No video source provided');
        setIsLoading(false);
      }
      if (!video) {
        logger.error(`[VideoHoverPlayDebug] [${currentComponentId}] Video element ref not available in main effect.`);
      }
      return;
    }

    if (prevSrcRef.current !== src) {
      logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] Source changed. Old: ${prevSrcRef.current?.substring(0, 30)}, New: ${src.substring(0, 30)}. Resetting state.`);
      setError(null);
      setErrorDetails('');
      setIsLoading(true);
      setPlayAttempted(false); // Reset playAttempted on src change
      setLoadedDataFired(false); // Reset loadedDataFired on src change
      video.pause();
      try {
        video.preload = "auto";
        const isHlsStream = src.endsWith('.m3u8') || src.includes('.m3u8?');
        const hasNativeHls = video.canPlayType('application/vnd.apple.mpegURL') || video.canPlayType('application/x-mpegURL');
        if (!(isHlsStream && !hasNativeHls)) {
          // Only assign directly if it's not a HLS stream without native support; hls.js will attach instead.
          video.src = src;
        }
        if (poster) {
          video.poster = poster;
        }
        video.load();
        logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] video.load() called for new src.`);
      } catch (err) {
        logger.error(`[VideoHoverPlayDebug] [${currentComponentId}] Error setting up video src/load:`, err);
        const errorMessage = `Setup error: ${err}`;
        setError(errorMessage);
        setIsLoading(false);
        if (onError) onError(errorMessage);
        prevSrcRef.current = src;
        return;
      }
    } else {
      logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] Source is the same (${src.substring(0, 30)}). Not resetting loading state.`);
    }

    prevSrcRef.current = src;

    const handleLoadedData = (event: Event) => {
      const currentVideoElement = videoRef?.current;
      const eventComponentId = currentVideoElement?.id || 'unknown_video_id_event';
      if (!currentVideoElement || (prevSrcRef.current !== currentVideoElement.currentSrc && !(isBlobUrl && currentVideoElement.currentSrc?.startsWith('blob:')))) {
         logger.warn(`[VideoHoverPlayDebug] [${eventComponentId}] handleLoadedData called for old src ('${prevSrcRef.current?.substring(0,15)}') or missing video. Current video src: '${currentVideoElement?.currentSrc?.substring(0,15)}'. Ignoring.`);
         return;
      }
      if (unmountedRef.current) {
        logger.log(`[VideoHoverPlayDebug] [${eventComponentId}] handleLoadedData: Component unmounted. Ignoring. src: ${currentVideoElement.currentSrc?.substring(0,30)}`);
        return;
      }

      logger.log(`[VideoHoverPlayDebug] [${eventComponentId}] Video loaded successfully (loadeddata event): ${currentVideoElement.currentSrc?.substring(0, 30)}`);
      setIsLoading(false);
      setLoadedDataFired(true);
      
      if (onLoadedData) {
        logger.log(`[VideoHoverPlayDebug] [${eventComponentId}] Firing onLoadedData callback for ${currentVideoElement.currentSrc?.substring(0, 30)}`);
        onLoadedData(event);
      }
    };
    
    const handleError = () => {
      const currentVideoElement = videoRef?.current;
      const eventComponentId = currentVideoElement?.id || 'unknown_video_id_event';
      if (!currentVideoElement || (prevSrcRef.current !== currentVideoElement.src && !(isBlobUrl && currentVideoElement.src?.startsWith('blob:')))) {
        logger.warn(`[VideoHoverPlayDebug] [${eventComponentId}] handleError called for old src ('${prevSrcRef.current?.substring(0,15)}') or missing video. Current video src: '${currentVideoElement?.src?.substring(0,15)}'. Ignoring.`);
        return;
      }
      if (unmountedRef.current) {
        logger.log(`[VideoHoverPlayDebug] [${eventComponentId}] handleError: Component unmounted. Ignoring. src: ${currentVideoElement.src?.substring(0,30)}`);
        return;
      }

      const { message, details } = getVideoErrorMessage(currentVideoElement.error, currentVideoElement.src);
      const format = getVideoFormat(currentVideoElement.src);
      
      if (isBlobUrl) {
        logger.error(`[VideoHoverPlayDebug] [${eventComponentId}] Blob URL error for ${currentVideoElement.src?.substring(0, 30)}: ${message}`);
        setError('The temporary preview cannot be played');
        setErrorDetails('This may be due to the blob URL being created in a different browser context or session');
        setIsLoading(false);
        if (onError) onError('Blob URL cannot be played: ' + message);
        return;
      }
      
      logger.error(`[VideoHoverPlayDebug] [${eventComponentId}] Video error event for ${currentVideoElement.src?.substring(0, 30)}: ${message}`);
      logger.error(`[VideoHoverPlayDebug] [${eventComponentId}] Video error details: ${details}, Detected format: ${format}`);
      
      setError(message);
      setErrorDetails(details + ` Detected format: ${format}`);
      setIsLoading(false);
      if (onError) onError(message);
    };
    
    // Ensure listeners are added only if the src is current, to avoid issues with stale closures if src changes rapidly.
    if (prevSrcRef.current === src && video.src === src) {
       video.addEventListener('loadeddata', handleLoadedData);
       video.addEventListener('error', handleError);
       logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] Added event listeners for src: ${src.substring(0,15)}`);
    } else {
       logger.warn(`[VideoHoverPlayDebug] [${currentComponentId}] Did not add listeners. prevSrcRef.current: ${prevSrcRef.current?.substring(0,15)}, video.src: ${video.src?.substring(0,15)}, currentHookSrc: ${src.substring(0,15)}`);
    }

    return () => {
      const cleanupVideoElement = videoRef?.current;
      const cleanupComponentId = cleanupVideoElement?.id || 'unknown_video_id_cleanup';
      if (cleanupVideoElement) {
         cleanupVideoElement.removeEventListener('loadeddata', handleLoadedData);
         cleanupVideoElement.removeEventListener('error', handleError);
         logger.log(`[VideoHoverPlayDebug] [${cleanupComponentId}] Removed event listeners for src: ${cleanupVideoElement.currentSrc?.substring(0,15)} (was ${prevSrcRef.current?.substring(0,15)})`);
      }
    };
  }, [src, videoRef, onError, poster, isBlobUrl, setIsLoading, setLoadedDataFired, setError, setErrorDetails, onLoadedData]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    const currentComponentId = video?.id || 'unknown_video_id_retry';
    
    logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] Retrying video load for: ${src.substring(0, 30)}`);
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setPlayAttempted(false);
    setLoadedDataFired(false);
    // prevSrcRef.current = null; // Setting to null forces full reload logic in main effect

    // More robust retry: ensure src is reset if it's already the same, so 'load()' is effective
    const currentSrc = video.currentSrc;
    if (video.src === src && currentSrc === src && !isLoading) {
      logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] Retry: src is same and not loading, forcing re-assign and load.`);
      video.src = ''; // Force change
      video.src = src;
    }
    video.load();
    logger.log(`[VideoHoverPlayDebug] [${currentComponentId}] video.load() called on retry.`);
  };

  return {
    error,
    isLoading,
    errorDetails,
    isBlobUrl,
    handleRetry,
    setPlayAttempted,
    playAttempted
  };
};
