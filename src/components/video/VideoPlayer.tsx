import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { Play } from 'lucide-react';
import VideoError from './VideoError';
import VideoLoader from './VideoLoader';
import VideoOverlay from './VideoOverlay';
import LazyPosterImage from './LazyPosterImage';
import { useVideoLoader } from '@/hooks/useVideoLoader';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

const logger = new Logger('VideoPlayer');

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  triggerPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  controls?: boolean;
  onClick?: (event: React.MouseEvent<HTMLVideoElement>) => void;
  onLoadedData?: (event: React.SyntheticEvent<HTMLVideoElement, Event> | Event) => void;
  onTimeUpdate?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onError?: (message: string) => void;
  onLoadStart?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPause?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPlay?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPlaying?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onProgress?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onSeeked?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onSeeking?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onWaiting?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onDurationChange?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVolumeChange?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onAbort?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onCanPlay?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onCanPlayThrough?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEmptied?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEncrypted?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onStalled?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onSuspend?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onRateChange?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  poster?: string;
  playOnHover?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
  showPlayButtonOnHover?: boolean;
  externallyControlled?: boolean;
  isHovering?: boolean;
  lazyLoad?: boolean;
  isMobile?: boolean;
  preventLoadingFlicker?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  showFirstFrameAsPoster?: boolean;
  onVisibilityChange?: (isVisible: boolean) => void;
  intersectionOptions?: IntersectionObserverInit;
  onEnterPreloadArea?: (isInPreloadArea: boolean) => void;
  preloadMargin?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  autoPlay = false,
  triggerPlay = false,
  muted = true,
  loop = false,
  className = '',
  controls = true,
  onClick,
  onLoadedData,
  onTimeUpdate,
  onEnded,
  onError,
  onLoadStart,
  onPause,
  onPlay,
  onPlaying,
  onProgress,
  onSeeked,
  onSeeking,
  onWaiting,
  onDurationChange,
  onVolumeChange,
  onLoadedMetadata,
  onAbort,
  onCanPlay,
  onCanPlayThrough,
  onEmptied,
  onEncrypted,
  onStalled,
  onSuspend,
  onRateChange,
  videoRef: externalVideoRef,
  poster,
  playOnHover = false,
  containerRef: externalContainerRef,
  showPlayButtonOnHover = true,
  externallyControlled = false,
  isHovering = false,
  lazyLoad = true,
  isMobile = false,
  preventLoadingFlicker = true,
  preload: preloadProp,
  showFirstFrameAsPoster = false,
  onVisibilityChange,
  intersectionOptions = { threshold: 0.25 },
  onEnterPreloadArea,
  preloadMargin = '0px 0px 600px 0px',
}) => {
  const componentId = useRef(`video_player_${Math.random().toString(36).substring(2, 9)}`).current;
  logger.log(`[${componentId}] Rendering. src: ${src?.substring(0,30)}..., poster: ${!!poster}, lazyLoad: ${lazyLoad}, preventLoadingFlicker: ${preventLoadingFlicker}`);

  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isInternallyHovering, setIsInternallyHovering] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [forcedPlay, setForcedPlay] = useState(false);
  const unmountedRef = useRef(false);
  const [initialFrameLoaded, setInitialFrameLoaded] = useState(false);
  
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
  
  useEffect(() => {
    if (triggerPlay && videoRef.current && videoRef.current.paused && !unmountedRef.current) {
      logger.log(`[${componentId}] triggerPlay is true, attempting to play.`);
      videoRef.current.play().catch(err => {
        logger.error(`[${componentId}] Error attempting to play via triggerPlay:`, err);
      });
    }
  }, [triggerPlay, videoRef]);
  
  useVideoPlayback({
    videoRef,
    externallyControlled,
    isHovering: externallyControlled ? isHovering : isInternallyHovering,
    muted,
    isMobile,
    loadedDataFired: !isLoading,
    playAttempted,
    setPlayAttempted,
    forcedPlay,
    componentId
  });
  
  useEffect(() => {
    logger.log(`[${componentId}] Mounting effect ran.`);
    return () => {
      logger.log(`[${componentId}] Unmounting.`);
      unmountedRef.current = true;
    };
  }, []);
  
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
  
  React.useEffect(() => {
    if (isMobile && poster) {
      logger.log(`[${componentId}] Mobile: skipping poster load, marking poster as loaded for URL: ${poster.substring(0, 30)}...`);
      setPosterLoaded(true);
      return;
    }
    if (poster) {
      const img = new Image();
      img.onload = () => {
        if (!unmountedRef.current) {
          setPosterLoaded(true);
          logger.log(`[${componentId}] Poster image loaded successfully: ${poster.substring(0, 30)}...`);
        }
      };
      img.onerror = (e) => {
        logger.error(`[${componentId}] Failed to load poster image:`, poster, e);
        if (!unmountedRef.current) {
          setPosterLoaded(false);
        }
      };
      logger.log(`[${componentId}] Starting poster load: ${poster.substring(0, 30)}...`);
      img.src = poster;
    } else {
      logger.log(`[${componentId}] No poster provided.`);
      setPosterLoaded(false);
    }
  }, [poster, isMobile]);
  
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

  // Avoid showing an endless loader on mobile devices where no poster image exists.
  // On many mobile browsers the video won't begin loading until user interaction,
  // which means `isLoading` can stay true forever. In that scenario the user just
  // sees a spinner. To improve UX we skip the loader entirely on mobile and rely
  // on the overlay/play‑tap interaction instead.
  const shouldShowLoading = !isMobile && isLoading && (!preventLoadingFlicker || !poster);
  logger.log(`[${componentId}] State: isLoading=${isLoading}, error=${!!error}, hasInteracted=${hasInteracted}, posterLoaded=${posterLoaded}, externallyControlled=${externallyControlled}`);
  logger.log(`[${componentId}] Visibility: shouldShowLoading=${shouldShowLoading}, videoOpacity=${(lazyLoad && poster && !hasInteracted && !externallyControlled) ? 0 : 1}`);

  const effectivePreload = showFirstFrameAsPoster ? 'metadata' : (preloadProp || 'auto');
  const effectiveAutoPlay = showFirstFrameAsPoster || autoPlay;

  const handleLoadedDataInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event> | Event) => {
    logger.log(`[${componentId}] onLoadedData triggered. showFirstFrameAsPoster: ${showFirstFrameAsPoster}, initialFrameLoaded: ${initialFrameLoaded}`);
    if (videoRef.current && showFirstFrameAsPoster && !initialFrameLoaded) {
      logger.log(`[${componentId}] Pausing on first frame.`);
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setInitialFrameLoaded(true);
    }
    if (onLoadedData) {
      onLoadedData(event);
    }
  }, [showFirstFrameAsPoster, initialFrameLoaded, onLoadedData, videoRef, componentId]);

  // Setup Intersection Observer using the hook
  const isIntersecting = useIntersectionObserver(containerRef, intersectionOptions);

  // Notify parent component when visibility changes
  useEffect(() => {
    if (onVisibilityChange && !unmountedRef.current) {
      logger.log(`[${componentId}] Visibility changed: ${isIntersecting}`);
      onVisibilityChange(isIntersecting);
    }
  }, [isIntersecting, onVisibilityChange]);

  // Don't show poster if the initial frame is loaded (and flag is set)
  const shouldShowPoster = poster && !(showFirstFrameAsPoster && initialFrameLoaded);

  // Add event listener for initial frame loading
  const handleLoadedMetadataInternal = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!unmountedRef.current) {
      logger.log(`[${componentId}] Loaded metadata.`);
      if (showFirstFrameAsPoster) {
        setInitialFrameLoaded(true);
        logger.log(`[${componentId}] Marked initial frame as loaded.`);
      }
      if (onLoadedMetadata) onLoadedMetadata(e);
    }
  };

  // Internal handler for the video element's onError event
  const handleVideoError = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    if (!unmountedRef.current) {
      logger.error(`[${componentId}] Video element reported error event:`, event);
      const videoElement = event.currentTarget;
      let errorMessage = 'An unknown video error occurred.';
      if (videoElement.error) {
        switch (videoElement.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Video playback aborted.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'A network error caused video download to fail.';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Video playback failed due to a decoding error.';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'The video source is not supported.';
            break;
          default:
            errorMessage = `An error occurred: ${videoElement.error.message} (Code: ${videoElement.error.code})`;
        }
      }
      // Call the prop onError with the formatted message
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [onError, componentId]);

  // --- Intersection Observer for Preloading --- 
  const preloadObserverOptions = useMemo(() => ({ rootMargin: preloadMargin, threshold: 0 }), [preloadMargin]);
  const isInPreloadArea = useIntersectionObserver(containerRef, preloadObserverOptions);
  useEffect(() => {
    if (onEnterPreloadArea && !unmountedRef.current) {
      logger.log(`[${componentId}] Preload Area Visibility changed: ${isInPreloadArea}`);
      onEnterPreloadArea(isInPreloadArea);
    }
  }, [isInPreloadArea, onEnterPreloadArea]);

  useEffect(() => {
    if (isIntersecting && isMobile && videoRef.current && videoRef.current.paused && !unmountedRef.current) {
      logger.log(`[${componentId}] Mobile intersection detected, attempting autoplay.`);
      videoRef.current.play().catch(err => {
        logger.error(`[${componentId}] Mobile autoplay failed:`, err);
      });
    }
  }, [isIntersecting, isMobile, videoRef]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden rounded-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-is-mobile={isMobile ? "true" : "false"}
    >
      {shouldShowLoading && !poster && <VideoLoader posterImage={poster} />}
      
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
        className={cn(
          "w-full h-full object-cover rounded-md transition-opacity duration-300",
          className,
          (preventLoadingFlicker && (!posterLoaded && !initialFrameLoaded && !error && isLoading)) ? 'opacity-0' : 'opacity-100'
        )}
        autoPlay={effectiveAutoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        poster={poster}
        preload={effectivePreload}
        src={src}
        crossOrigin="anonymous"
        onClick={handleVideoClick}
        onLoadedData={handleLoadedDataInternal}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onError={handleVideoError}
        onLoadStart={onLoadStart}
        onPause={onPause}
        onPlay={onPlay}
        onPlaying={onPlaying}
        onProgress={onProgress}
        onSeeked={onSeeked}
        onSeeking={onSeeking}
        onWaiting={onWaiting}
        onDurationChange={onDurationChange}
        onVolumeChange={onVolumeChange}
        onLoadedMetadata={handleLoadedMetadataInternal}
        onAbort={onAbort}
        onCanPlay={onCanPlay}
        onCanPlayThrough={onCanPlayThrough}
        onEmptied={onEmptied}
        onEncrypted={onEncrypted}
        onStalled={onStalled}
        onSuspend={onSuspend}
        onRateChange={onRateChange}
      >
        Your browser does not support the video tag.
      </video>
      
      {(!isLoading || (isLoading && poster && posterLoaded)) && !error && showPlayButtonOnHover && !isMobile && isInternallyHovering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 opacity-0 hover:opacity-100 pointer-events-none">
          <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
            <Play className="h-8 w-8 text-white" fill="white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
