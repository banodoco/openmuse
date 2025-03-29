
import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  lazyLoad?: boolean;
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
  lazyLoad = true,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [isBlobUrl, setIsBlobUrl] = useState<boolean>(src?.startsWith('blob:') || false);
  const [videoLoaded, setVideoLoaded] = useState(!lazyLoad || autoPlay || false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [playAttempted, setPlayAttempted] = useState(false);
  const [loadedDataFired, setLoadedDataFired] = useState(false);
  
  // Setup hover behavior - only if not externally controlled
  useVideoHover(containerRef, videoRef, {
    enabled: playOnHover && !externallyControlled,
    resetOnLeave: true
  });
  
  // Handle lazy loading of video
  const loadFullVideo = useCallback(() => {
    if (!videoLoaded) {
      logger.log('Loading full video on hover');
      setVideoLoaded(true);
      setHasInteracted(true);
    }
  }, [videoLoaded]);
  
  // Reset state when src changes
  useEffect(() => {
    setLoadedDataFired(false);
    setPlayAttempted(false);
  }, [src]);
  
  // Handle external hover control
  useEffect(() => {
    const video = videoRef.current;
    if (externallyControlled && video && !playAttempted) {
      logger.log(`External hover state: ${isHovering ? 'hovering' : 'not hovering'}`);
      
      if (isHovering) {
        loadFullVideo();
        logger.log('VideoPlayer: External hover detected - playing video');
        // Small delay to avoid conflicts with other operations
        setTimeout(() => {
          attemptVideoPlay(video, muted);
          setPlayAttempted(true);
        }, 100);
      } else if (!isHovering && !video.paused) {
        logger.log('VideoPlayer: External hover ended - pausing video');
        video.pause();
      }
    }
  }, [isHovering, externallyControlled, muted, loadFullVideo, playAttempted]);

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

  // Handle video element setup when src changes or when video is loaded on hover
  useEffect(() => {
    if (!src || !videoLoaded) {
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
      
      // Don't autoplay if we're using hover to play or lazy loading
      if (autoPlay && !playOnHover && !externallyControlled) {
        // Small delay to ensure the video is ready
        setTimeout(() => {
          attemptVideoPlay(video, muted);
        }, 150);
      }
      
      // For externally controlled video, check if we should play immediately
      if (externallyControlled && isHovering) {
        logger.log('VideoPlayer: Initially hovering - playing video immediately');
        // Small delay to ensure the video is ready
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
      // Only set the full video source if we're loading the video
      video.preload = videoLoaded ? "auto" : "metadata";
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
  }, [src, autoPlay, muted, onLoadedData, videoRef, onError, poster, playOnHover, isBlobUrl, externallyControlled, isHovering, videoLoaded]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    logger.log(`Retrying video load for: ${src.substring(0, 30)}...`);
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setPlayAttempted(false);
    setLoadedDataFired(false);
    
    // Simply reload the video
    video.load();
  };

  const handleMouseEnter = () => {
    loadFullVideo();
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden rounded-lg"
      onMouseEnter={handleMouseEnter}
    >
      {isLoading && videoLoaded && <VideoLoader posterImage={poster} />}
      
      {error && !onError && (
        <VideoError 
          error={error} 
          errorDetails={errorDetails} 
          onRetry={handleRetry}
          videoSource={src}
        />
      )}
      
      {/* Show poster if lazy loading and not yet loaded */}
      {lazyLoad && !hasInteracted && poster && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${poster})` }} />
      )}
      
      <video
        ref={videoRef}
        className={cn("w-full h-full object-cover", className, {
          'opacity-0': lazyLoad && !videoLoaded
        })}
        autoPlay={autoPlay && !playOnHover && !externallyControlled}
        muted={muted}
        loop={loop}
        controls={showPlayButtonOnHover ? controls : false}
        playsInline
        poster={poster || undefined}
        preload={videoLoaded ? "auto" : "metadata"}
        src={videoLoaded ? src : undefined}
        crossOrigin="anonymous"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
