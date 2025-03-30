import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { useVideoHover } from '@/hooks/useVideoHover';
import { attemptVideoPlay, getVideoErrorMessage, isValidVideoUrl, getVideoFormat } from '@/lib/utils/videoUtils';
import VideoError from './VideoError';
import VideoLoader from './VideoLoader';
import { Play } from 'lucide-react'; // Add the Play icon import

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
  isMobile?: boolean;
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
  isMobile = false,
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
  const [isInternallyHovering, setIsInternallyHovering] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  
  useVideoHover(containerRef, videoRef, {
    enabled: playOnHover && !externallyControlled && !isMobile,
    resetOnLeave: true
  });
  
  const loadFullVideo = useCallback(() => {
    if (!videoLoaded) {
      logger.log('Loading full video on hover');
      setVideoLoaded(true);
      setHasInteracted(true);
    }
  }, [videoLoaded]);

  useEffect(() => {
    if (poster) {
      const img = new Image();
      img.onload = () => {
        setPosterLoaded(true);
        logger.log('Poster image loaded successfully');
      };
      img.onerror = () => {
        logger.error('Failed to load poster image:', poster);
        setPosterLoaded(false);
      };
      img.src = poster;
    }
  }, [poster]);
  
  useEffect(() => {
    setLoadedDataFired(false);
    setPlayAttempted(false);
  }, [src]);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (externallyControlled && !isMobile) {
      logger.log(`External hover state: ${isHovering ? 'hovering' : 'not hovering'}`);
      
      if (isHovering) {
        loadFullVideo();
        logger.log('VideoPlayer: External hover detected - playing video');
        
        if (!playAttempted) {
          setTimeout(() => {
            if (video && video.readyState >= 2) {
              attemptVideoPlay(video, muted)
                .then(() => logger.log('Play succeeded on hover'))
                .catch(e => logger.error('Play failed on hover:', e));
              setPlayAttempted(true);
            }
          }, 100);
        }
      } else if (!isHovering && !video.paused) {
        logger.log('VideoPlayer: External hover ended - pausing video');
        video.pause();
      }
    }
  }, [isHovering, externallyControlled, videoRef, muted, loadFullVideo, playAttempted, isMobile]);
  
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
      
      if (autoPlay && !playOnHover && !externallyControlled && !isMobile) {
        setTimeout(() => {
          attemptVideoPlay(video, muted);
        }, 150);
      }
      
      if (!isMobile && ((externallyControlled && isHovering) || (playOnHover && isInternallyHovering))) {
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
  }, [src, autoPlay, muted, onLoadedData, videoRef, onError, poster, playOnHover, isBlobUrl, externallyControlled, isHovering, videoLoaded, isInternallyHovering, isMobile]);
  
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

  const handleMouseEnter = () => {
    if (!isMobile) {
      loadFullVideo();
      setIsInternallyHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsInternallyHovering(false);
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden rounded-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
      
      {isMobile && poster && (
        <div 
          className="absolute inset-0 bg-cover bg-center z-10" 
          style={{ backgroundImage: `url(${poster})` }} 
        />
      )}
      
      {!isMobile && lazyLoad && !hasInteracted && poster && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${poster})` }} />
      )}
      
      <video
        ref={videoRef}
        className={cn("w-full h-full object-cover", className, {
          'opacity-0': (lazyLoad && !videoLoaded) || (isMobile && poster && posterLoaded)
        })}
        autoPlay={autoPlay && !playOnHover && !externallyControlled && !isMobile}
        muted={muted}
        loop={loop}
        controls={isMobile ? true : (showPlayButtonOnHover ? controls : false)}
        playsInline
        poster={poster || undefined}
        preload={videoLoaded && !isMobile ? "auto" : "metadata"}
        src={videoLoaded ? src : undefined}
        crossOrigin="anonymous"
      >
        Your browser does not support the video tag.
      </video>
      
      {isMobile && poster && posterLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-black/30 rounded-full p-3 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
