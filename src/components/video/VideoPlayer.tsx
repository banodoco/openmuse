
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { useVideoHover } from '@/hooks/useVideoHover';
import { attemptVideoPlay, getVideoErrorMessage, isValidVideoUrl, getVideoFormat } from '@/lib/utils/videoUtils';
import VideoError from './VideoError';
import VideoLoader from './VideoLoader';

const logger = new Logger('VideoPlayer');

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  controls?: boolean;
  onLoadedData?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onError?: (message: string) => void;
  poster?: string;
  playOnHover?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
  showPlayButtonOnHover?: boolean;
  externallyControlled?: boolean;
  isHovering?: boolean;
  expandOnHover?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  autoPlay = false,
  muted = true,
  loop = false,
  className = '',
  controls = true,
  onLoadedData,
  videoRef: externalVideoRef,
  onError,
  poster,
  playOnHover = false,
  containerRef: externalContainerRef,
  showPlayButtonOnHover = true,
  externallyControlled = false,
  isHovering = false,
  expandOnHover = true,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [isBlobUrl, setIsBlobUrl] = useState<boolean>(src?.startsWith('blob:') || false);
  const [hover, setHover] = useState(isHovering);
  // Add the missing state variable
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    logger.log(`VideoPlayer: Initial hover state: ${isHovering ? 'hovering' : 'not hovering'}`);
  }, []);

  useEffect(() => {
    const prevHover = hover;
    setHover(isHovering);
    
    if (!prevHover && isHovering) {
      logger.log('VideoPlayer: External hover state changed to true');
      logger.log('VideoPlayer: Video should now expand');
    } else if (prevHover && !isHovering) {
      logger.log('VideoPlayer: External hover state changed to false');
      logger.log('VideoPlayer: Video should revert to normal display');
    }
  }, [isHovering, hover]);

  useVideoHover(containerRef, videoRef, {
    enabled: playOnHover && !externallyControlled,
    resetOnLeave: true
  });

  useEffect(() => {
    const video = videoRef.current;
    if (externallyControlled && video) {
      logger.log(`VideoPlayer: External hover state: ${isHovering ? 'hovering' : 'not hovering'}`);
      
      if (isHovering && (video.paused || video.ended)) {
        logger.log('VideoPlayer: External hover detected - playing video');
        attemptVideoPlay(video, muted);
      } else if (!isHovering && !video.paused) {
        logger.log('VideoPlayer: External hover ended - pausing video');
        video.pause();
      }
    }
  }, [isHovering, externallyControlled, muted]);

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
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setVideoLoaded(false);
    
    if (!src) {
      logger.log('No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
      return;
    }
    
    logger.log(`Loading video with source: ${src.substring(0, 50)}...`);
    
    const video = videoRef.current;
    if (!video) {
      logger.error('Video element reference not available');
      return;
    }
    
    const handleLoadedData = () => {
      logger.log(`Video loaded successfully: ${src.substring(0, 30)}...`);
      setIsLoading(false);
      setVideoLoaded(true);
      if (onLoadedData) onLoadedData();
      
      if (autoPlay && !playOnHover && !externallyControlled) {
        attemptVideoPlay(video, muted);
      }
      
      if (externallyControlled && isHovering) {
        logger.log('VideoPlayer: Initially hovering - playing video immediately');
        attemptVideoPlay(video, muted);
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
  }, [src, autoPlay, muted, onLoadedData, videoRef, onError, poster, playOnHover, isBlobUrl, externallyControlled, isHovering]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    logger.log(`Retrying video load for: ${src.substring(0, 30)}...`);
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    
    video.load();
  };

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative w-full h-full overflow-visible rounded-lg",
        expandOnHover && hover ? "absolute z-50 inset-0" : "relative"
      )}
      style={{
        position: expandOnHover && hover ? 'fixed' : 'relative',
        top: expandOnHover && hover ? '50%' : 'auto',
        left: expandOnHover && hover ? '50%' : 'auto',
        transform: expandOnHover && hover ? 'translate(-50%, -50%)' : 'none',
        width: expandOnHover && hover ? '90vw' : '100%',
        height: expandOnHover && hover ? '90vh' : '100%',
        maxWidth: expandOnHover && hover ? '1200px' : '100%',
        maxHeight: expandOnHover && hover ? '800px' : '100%',
        zIndex: expandOnHover && hover ? 1000 : 'auto',
      }}
    >
      {isLoading && <VideoLoader posterImage={poster} />}
      
      {error && !onError && (
        <VideoError 
          error={error} 
          errorDetails={errorDetails} 
          onRetry={handleRetry}
          videoSource={src}
        />
      )}
      
      <video
        ref={videoRef}
        className={cn(
          "w-full h-full transition-all duration-300",
          hover && expandOnHover ? "object-contain" : "object-cover",
          className
        )}
        autoPlay={autoPlay && !playOnHover && !externallyControlled}
        muted={muted}
        loop={loop}
        controls={showPlayButtonOnHover ? controls : false}
        playsInline
        poster={poster || undefined}
        preload="auto"
        src={src}
        crossOrigin="anonymous"
        style={{
          objectFit: hover && expandOnHover ? 'contain' : 'cover'
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
