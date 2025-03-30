
import { useState, useEffect, useRef } from 'react';
import { Logger } from '@/lib/logger';
import { getVideoErrorMessage, isValidVideoUrl, getVideoFormat, attemptVideoPlay } from '@/lib/utils/videoUtils';

const logger = new Logger('useVideoLoader');

interface UseVideoLoaderProps {
  src: string;
  poster?: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  onError?: (message: string) => void;
  onLoadedData?: () => void;
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
    if (!src) {
      return;
    }
    
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setPlayAttempted(false);
    setLoadedDataFired(false);
    
    logger.log(`Loading video with source: ${src.substring(0, 50)}...`);
    
    const video = videoRef.current;
    if (!video) {
      logger.error('Video element reference not available');
      return;
    }
    
    const handleLoadedData = () => {
      logger.log(`Video loaded successfully: ${src.substring(0, 30)}...`);
      setIsLoading(false);
      setLoadedDataFired(true);
      
      if (onLoadedData) {
        logger.log('Firing onLoadedData callback');
        onLoadedData();
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
    
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    video.pause();
    
    try {
      video.preload = "auto";
      video.src = src;
      if (poster) {
        video.poster = poster;
      }
      video.load();
    } catch (err) {
      logger.error('Error setting up video:', err);
      const errorMessage = `Setup error: ${err}`;
      setError(errorMessage);
      setIsLoading(false);
      if (onError) onError(errorMessage);
    }
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      
      video.pause();
      video.src = '';
      video.load();
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
