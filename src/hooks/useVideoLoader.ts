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
    setIsBlobUrl(src?.startsWith('blob:') || false);
    
    if (!src) {
      logger.error('No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
      return;
    }
    
    if (!isBlobUrl && !isValidVideoUrl(src)) {
      const format = getVideoFormat(src);
      const errorMsg = `Invalid video source: ${src.substring(0, 50)}...`;
      logger.error(errorMsg);
      setError(`The video URL appears to be invalid or inaccessible`);
      setErrorDetails(`Source doesn't appear to be a playable video URL. Format detected: ${format}`);
      setIsLoading(false);
      if (onError) onError(errorMsg);
    }
  }, [src, onError, isBlobUrl]);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!src || !video) {
      if (!src) {
        logger.error('No source provided to VideoPlayer hook');
      }
      if (!video) {
        logger.error('Video element reference not available in hook');
      }
      return;
    }

    if (prevSrcRef.current !== src) {
      logger.log(`Source changed from ${prevSrcRef.current?.substring(0, 30)}... to ${src.substring(0, 30)}... Resetting state.`);
      setError(null);
      setErrorDetails('');
      setIsLoading(true);
      setPlayAttempted(false);
      setLoadedDataFired(false);
      video.pause();
      try {
        video.preload = "auto";
        video.src = src;
        if (poster) {
          video.poster = poster;
        }
        video.load();
      } catch (err) {
        logger.error('Error setting up video src/load:', err);
        const errorMessage = `Setup error: ${err}`;
        setError(errorMessage);
        setIsLoading(false);
        if (onError) onError(errorMessage);
        prevSrcRef.current = src;
        return;
      }
    } else {
      logger.log(`Source is the same (${src.substring(0, 30)}...). Not resetting loading state.`);
    }

    prevSrcRef.current = src;

    const handleLoadedData = () => {
      if (prevSrcRef.current !== video.currentSrc && !(isBlobUrl && video.currentSrc?.startsWith('blob:'))) {
         logger.warn(`[${src.substring(0,15)}] handleLoadedData called for old src (${video.currentSrc?.substring(0,15)}). Ignoring.`);
         return;
      }
      if (unmountedRef.current) return;

      logger.log(`Video loaded successfully: ${src.substring(0, 30)}...`);
      setIsLoading(false);
      setLoadedDataFired(true);
      
      if (onLoadedData) {
        logger.log('Firing onLoadedData callback');
        onLoadedData(event);
      }
      
      if (autoPlay && !playOnHover && !externallyControlled && !isMobile) {
        setTimeout(() => {
          attemptVideoPlay(video, muted);
        }, 150);
      }
      
      if (!isMobile && ((externallyControlled && isHovering) || (playOnHover && isHovering))) {
        logger.log('VideoPlayer: Initially hovering - playing video immediately');
        setTimeout(() => {
          attemptVideoPlay(video, muted).then(() => {
            logger.log('Auto-play successful in lightbox');
          }).catch(err => {
            logger.error('Auto-play failed in lightbox:', err);
          });
        }, 150);
      }
    };
    
    const handleError = () => {
      if (prevSrcRef.current !== video.src && !(isBlobUrl && video.src?.startsWith('blob:'))) {
        logger.warn(`[${src.substring(0,15)}] handleError called for old src (${video.src?.substring(0,15)}). Ignoring.`);
        return;
      }
      if (unmountedRef.current) return;

      const { message, details } = getVideoErrorMessage(video.error, src);
      const format = getVideoFormat(src);
      
      if (isBlobUrl) {
        setError('The temporary preview cannot be played');
        setErrorDetails('This may be due to the blob URL being created in a different browser context or session');
        setIsLoading(false);
        if (onError) onError('Blob URL cannot be played: ' + message);
        return;
      }
      
      logger.error(`Video error for ${src.substring(0, 30)}...: ${message}`);
      logger.error(`Video error details: ${details}`);
      logger.error(`Detected format: ${format}`);
      
      setError(message);
      setErrorDetails(details + ` Detected format: ${format}`);
      setIsLoading(false);
      if (onError) onError(message);
    };
    
    if (prevSrcRef.current === src) {
       video.addEventListener('loadeddata', handleLoadedData);
       video.addEventListener('error', handleError);
    }

    return () => {
      if (video) {
         video.removeEventListener('loadeddata', handleLoadedData);
         video.removeEventListener('error', handleError);
      }
    };
  }, [src, autoPlay, muted, onLoadedData, videoRef, onError, poster, playOnHover, isBlobUrl, externallyControlled, isHovering, isMobile]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    logger.log(`Retrying video load for: ${src.substring(0, 30)}...`);
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setPlayAttempted(false);
    setLoadedDataFired(false);
    prevSrcRef.current = null;

    video.load();
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
