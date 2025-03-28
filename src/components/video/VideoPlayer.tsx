
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
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Add debug logs for hover state changes
  useEffect(() => {
    logger.log(`VideoPlayer: Initial hover state: ${isHovering ? 'hovering' : 'not hovering'}`);
  }, []);

  // Sync external hover state
  useEffect(() => {
    const prevHover = hover;
    setHover(isHovering);
    
    if (!prevHover && isHovering) {
      logger.log('VideoPlayer: External hover state changed to true');
      logger.log('VideoPlayer: Video should now expand to show full content');
    } else if (prevHover && !isHovering) {
      logger.log('VideoPlayer: External hover state changed to false');
      logger.log('VideoPlayer: Video should revert to normal display');
    }
  }, [isHovering, hover]);

  // Setup hover behavior - only if not externally controlled
  useVideoHover(containerRef, videoRef, {
    enabled: playOnHover && !externallyControlled,
    resetOnLeave: true
  });
  
  // Handle external hover control
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

  // Validate video source
  useEffect(() => {
    setIsBlobUrl(src?.startsWith('blob:') || false);
    
    if (!src) {
      logger.error('No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
      return;
    }
    
    // Allow blob URLs to pass validation
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

  // Handle video element setup when src changes
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
      
      // Don't autoplay if we're using hover to play
      if (autoPlay && !playOnHover && !externallyControlled) {
        attemptVideoPlay(video, muted);
      }
      
      // For externally controlled video, check if we should play immediately
      if (externallyControlled && isHovering) {
        logger.log('VideoPlayer: Initially hovering - playing video immediately');
        attemptVideoPlay(video, muted);
      }
    };
    
    const handleError = () => {
      const { message, details } = getVideoErrorMessage(video.error, src);
      const format = getVideoFormat(src);
      
      // Special message for blob URLs
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
    
    // Always pause first to ensure consistent state
    video.pause();
    
    try {
      video.preload = "auto"; // Ensure video preloads
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
    
    // Simply reload the video
    video.load();
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden rounded-lg"
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
          hover ? "object-contain transform-gpu scale-100" : "object-cover",
          videoLoaded && hover ? "scale-100" : "",
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
          objectFit: hover ? 'contain' : 'cover'
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
