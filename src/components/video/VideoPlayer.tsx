
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { Play } from 'lucide-react';
import VideoError from './VideoError';
import VideoLoader from './VideoLoader';
import VideoOverlay from './VideoOverlay';
import LazyPosterImage from './LazyPosterImage';
import { useVideoLoader } from '@/hooks/useVideoLoader';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';

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
  preventLoadingFlicker?: boolean;
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
  preventLoadingFlicker = false,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isInternallyHovering, setIsInternallyHovering] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [forcedPlay, setForcedPlay] = useState(false);
  const unmountedRef = useRef(false);
  
  // Use the video loader hook
  const {
    error,
    isLoading,
    errorDetails,
    handleRetry,
    playAttempted,
    setPlayAttempted
  } = useVideoLoader({
    src,
    poster,
    videoRef,
    onError,
    onLoadedData,
    autoPlay,
    muted,
    playOnHover,
    externallyControlled,
    isHovering: externallyControlled ? isHovering : isInternallyHovering,
    isMobile
  });
  
  // Use the video playback hook
  useVideoPlayback({
    videoRef,
    externallyControlled,
    isHovering: externallyControlled ? isHovering : isInternallyHovering,
    muted,
    isMobile,
    loadedDataFired: !isLoading,
    playAttempted,
    setPlayAttempted,
    forcedPlay
  });
  
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);
  
  // Force play for lightbox on mobile
  useEffect(() => {
    if (externallyControlled && isHovering && isMobile && !playAttempted && !isLoading && videoRef.current && !unmountedRef.current) {
      logger.log('Forcing play for lightbox on mobile');
      setForcedPlay(true);
      
      const attemptPlay = async () => {
        try {
          if (videoRef.current && !unmountedRef.current) {
            await videoRef.current.play();
            logger.log('Successfully forced play on mobile lightbox');
          }
        } catch (err) {
          logger.error('Failed to force play on mobile lightbox:', err);
        }
      };
      
      attemptPlay();
    }
  }, [externallyControlled, isHovering, isMobile, playAttempted, isLoading, videoRef]);
  
  // Effect to load poster image
  React.useEffect(() => {
    if (poster) {
      const img = new Image();
      img.onload = () => {
        if (!unmountedRef.current) {
          setPosterLoaded(true);
          logger.log(`Poster image loaded successfully: ${poster.substring(0, 30)}...`);
        }
      };
      img.onerror = (e) => {
        logger.error('Failed to load poster image:', poster, e);
        if (!unmountedRef.current) {
          setPosterLoaded(false);
        }
      };
      img.src = poster;
    }
  }, [poster]);
  
  // Add additional logging for mobile detection
  React.useEffect(() => {
    logger.log(`VideoPlayer isMobile state: ${isMobile}`);
    logger.log(`VideoPlayer poster: ${poster ? 'exists' : 'missing'}`);
    logger.log(`VideoPlayer posterLoaded: ${posterLoaded}`);
  }, [isMobile, poster, posterLoaded]);
  
  const loadFullVideo = useCallback(() => {
    if (!hasInteracted && !unmountedRef.current) {
      logger.log('Loading full video on hover');
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  const handleMouseEnter = () => {
    if (!isMobile && !unmountedRef.current) {
      loadFullVideo();
      setIsInternallyHovering(true);
    }
  };

  const handleMouseLeave = () => {
    if (!unmountedRef.current) {
      setIsInternallyHovering(false);
    }
  };

  const handleVideoClick = () => {
    if (isMobile && videoRef.current && !unmountedRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(err => {
          logger.error('Error playing video on click:', err);
        });
      } else {
        videoRef.current.pause();
      }
    }
  };

  // Determine if we should show loading state based on preventLoadingFlicker
  const shouldShowLoading = isLoading && (!preventLoadingFlicker || !poster || !isHovering);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden rounded-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-is-mobile={isMobile ? "true" : "false"}
    >
      {shouldShowLoading && <VideoLoader posterImage={poster} />}
      
      {error && !onError && (
        <VideoError 
          error={error} 
          errorDetails={errorDetails} 
          onRetry={handleRetry}
          videoSource={src}
        />
      )}
      
      <VideoOverlay 
        isMobile={isMobile && !externallyControlled} 
        poster={poster} 
        posterLoaded={posterLoaded} 
      />
      
      <LazyPosterImage 
        poster={poster} 
        lazyLoad={lazyLoad} 
        hasInteracted={hasInteracted || externallyControlled}
        isMobile={isMobile && !externallyControlled}
      />
      
      <video
        ref={videoRef}
        className={cn("w-full h-full object-cover", className, {
          'opacity-0': (lazyLoad && !hasInteracted && !externallyControlled) || 
                      (isMobile && poster && posterLoaded && !externallyControlled)
        })}
        autoPlay={autoPlay && (externallyControlled || (!playOnHover && !isMobile))}
        muted={muted}
        loop={loop}
        controls={isMobile ? true : (showPlayButtonOnHover ? controls : false)}
        playsInline
        poster={poster || undefined}
        preload={(hasInteracted || externallyControlled || preventLoadingFlicker) ? "auto" : "metadata"}
        src={src}
        crossOrigin="anonymous"
        onClick={handleVideoClick}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
