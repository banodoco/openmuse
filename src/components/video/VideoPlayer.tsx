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

// ---------------------------------------------------------------------------
// Network‑aware timeout helper
// ---------------------------------------------------------------------------
// If the user has a strong connection (e.g. 4g / ≥ 10 Mbps) we want to be
// aggressive (1 s).  On weaker links we progressively increase the grace
// period so we don't trigger false positives.  We default to 2.5 s.

const DEFAULT_TIMEOUT_MS = 2500; // Fallback when we can't detect the network.

/**
 * Decide an appropriate timeout based on the Network Information API.
 * Returns a value in milliseconds.
 */
const getNetworkAwareTimeout = (): number => {
  if (typeof navigator === 'undefined') return DEFAULT_TIMEOUT_MS;

  // `connection` can appear under vendor prefixes in some browsers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connection: any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (!connection) return DEFAULT_TIMEOUT_MS;

  const { downlink, effectiveType } = connection;

  // Prefer `effectiveType` because it incorporates latency + bandwidth.
  if (effectiveType) {
    switch (effectiveType) {
      case '4g':
        return 1000; // Strong connection → 1 s
      case '3g':
        return 1500; // Moderate → 1.5 s
      case '2g':
        return 2500; // Slow → 2.5 s
      case 'slow-2g':
        return 4000; // Very slow → 4 s
      default:
        break;
    }
  }

  // Fall back to raw `downlink` (in Mbps) when available.
  if (typeof downlink === 'number') {
    if (downlink >= 10) return 1000;
    if (downlink >= 5) return 1500;
    if (downlink >= 2) return 2500;
    return 4000;
  }

  return DEFAULT_TIMEOUT_MS;
};

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
  onPlay: onPlayProp,
  onPlaying,
  onProgress,
  onSeeked,
  onSeeking,
  onWaiting: onWaitingProp,
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
  const initialPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const dynamicTimeoutMs = useMemo(() => getNetworkAwareTimeout(), []);
  
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

  const effectivePreventLoadingFlicker = isMobile ? false : preventLoadingFlicker;
  const shouldShowLoading = !isMobile && isLoading && (!effectivePreventLoadingFlicker || !poster);
  logger.log(`[${componentId}] State: isLoading=${isLoading}, error=${!!error}, hasInteracted=${hasInteracted}, posterLoaded=${posterLoaded}, externallyControlled=${externallyControlled}`);
  logger.log(`[${componentId}] Visibility: shouldShowLoading=${shouldShowLoading}, videoOpacity=${(lazyLoad && poster && !hasInteracted && !externallyControlled) ? 0 : 1}`);

  const effectivePreload = showFirstFrameAsPoster ? 'metadata' : (preloadProp || 'auto');
  const effectiveAutoPlay = showFirstFrameAsPoster ? false : autoPlay;

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

  // Setup Intersection Observer using the hook - use a more sensitive threshold on mobile so that playback is triggered even when a small part is visible.
  const effectiveIntersectionOptions = useMemo<IntersectionObserverInit>(() => {
    if (isMobile) {
      return { rootMargin: '0px', threshold: 0 }; // Trigger as soon as any part becomes visible
    }
    return intersectionOptions;
  }, [isMobile, intersectionOptions]);

  const isIntersecting = useIntersectionObserver(containerRef, effectiveIntersectionOptions);

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

  // --- Timeout Reset Logic ---
  const attemptReset = useCallback(() => {
    if (videoRef.current && !unmountedRef.current && !error) {
      const video = videoRef.current;
      logger.warn(`[${componentId}] Video stalled, attempting reset. Current time: ${video.currentTime}, Ready state: ${video.readyState}, Paused: ${video.paused}`);
      // Store current time to restore position after load
      const currentTime = video.currentTime;
      video.load(); // Force reload of the video source
      video.play().then(() => {
        // Restore position slightly after play starts to ensure it takes effect
        setTimeout(() => {
          if (videoRef.current && !unmountedRef.current && video.currentTime === 0 && currentTime > 0) {
             video.currentTime = currentTime;
             logger.log(`[${componentId}] Reset successful, restored time to ${currentTime}`);
          } else if (videoRef.current) {
             logger.log(`[${componentId}] Reset play successful, current time is now ${video.currentTime}`);
          }
        }, 100);
      }).catch(err => {
        logger.error(`[${componentId}] Error playing after reset:`, err);
      });
    }
  }, [videoRef, componentId, error]);

  // --- Timeout Clearing ---
  const clearInitialPlayTimeout = useCallback(() => {
    if (initialPlayTimeoutRef.current) {
      clearTimeout(initialPlayTimeoutRef.current);
      initialPlayTimeoutRef.current = null;
      // logger.log(`[${componentId}] Cleared initial play timeout.`);
    }
  }, []);

  const clearWaitingTimeout = useCallback(() => {
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
      // logger.log(`[${componentId}] Cleared waiting timeout.`);
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearInitialPlayTimeout();
      clearWaitingTimeout();
      // logger.log(`[${componentId}] Unmounting, cleared timeouts.`);
      unmountedRef.current = true; // Ensure unmountedRef is set here as well
    };
  }, [clearInitialPlayTimeout, clearWaitingTimeout]);

  // --- Initial Play Timeout Logic ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasPlayedOnce || error || unmountedRef.current || !video.paused) {
      // If video already played, errored, unmounted, or is not paused, no need for timeout.
      clearInitialPlayTimeout();
      return;
    }

    // Condition 1: Mobile and intersecting (implicit autoplay expected)
    const shouldTimeoutMobile = isIntersecting && isMobile;
    // Condition 2: Desktop, play has been attempted (e.g., via autoplay, hover, click)
    const shouldTimeoutDesktop = !isMobile && playAttempted; // Use playAttempted from useVideoLoader

    if (shouldTimeoutMobile || shouldTimeoutDesktop) {
      logger.log(`[${componentId}] Starting initial play timeout (${dynamicTimeoutMs}ms). Reason: ${shouldTimeoutMobile ? 'Mobile Intersect' : 'Desktop Play Attempted'}`);
      clearInitialPlayTimeout(); // Clear previous just in case

      initialPlayTimeoutRef.current = setTimeout(() => {
        // Check again inside timeout in case state changed
        if (videoRef.current && videoRef.current.paused && !hasPlayedOnce && !error && !unmountedRef.current) {
          logger.warn(`[${componentId}] Initial play timeout expired, video hasn't played.`);
          attemptReset();
        } else {
           logger.log(`[${componentId}] Initial play timeout expired, but video state changed during timeout. No reset needed.`);
        }
      }, dynamicTimeoutMs);

      // Attempt immediate play logic (only for mobile intersect case?)
      if (shouldTimeoutMobile) {
         logger.log(`[${componentId}] Mobile intersection detected, attempting immediate autoplay.`);
         video.play().catch(err => {
           logger.error(`[${componentId}] Mobile immediate autoplay failed:`, err);
           // Let timeout handle reset
         });
      }

    } else if (!isIntersecting && isMobile) {
      // Clear timeout if mobile and no longer intersecting (and not explicitly triggered)
      // Desktop cases rely on playAttempted, which persists even if not intersecting.
      clearInitialPlayTimeout();
    }

    // Cleanup function is handled by the main unmount effect

  // Dependencies: MUST include everything used in the conditions and logic
  }, [isIntersecting, isMobile, videoRef, hasPlayedOnce, error, clearInitialPlayTimeout, attemptReset, componentId, dynamicTimeoutMs, playAttempted]); // Added playAttempted


  // --- Video Event Handlers ---
  const handlePlayInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    logger.log(`[${componentId}] onPlay event fired.`);
    setHasPlayedOnce(true);
    clearInitialPlayTimeout();
    clearWaitingTimeout();
    if (onPlayProp) onPlayProp(event);
  }, [onPlayProp, clearInitialPlayTimeout, clearWaitingTimeout, componentId]);

  const handlePauseInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    // logger.log(`[${componentId}] onPause event fired.`);
    clearWaitingTimeout(); // Clear waiting timeout if paused
    if (onPause) onPause(event);

    // Attempt to resume if paused unexpectedly while visible on mobile
    if (isMobile && isIntersecting && videoRef.current && !videoRef.current.ended && !unmountedRef.current) {
      logger.log(`[${componentId}] Paused while intersecting on mobile, attempting to resume shortly.`);
      setTimeout(() => {
        if (videoRef.current && videoRef.current.paused && isIntersecting && !videoRef.current.ended && !unmountedRef.current) {
          logger.log(`[${componentId}] Resuming play after pause.`);
          videoRef.current.play().catch(err => {
            logger.error(`[${componentId}] Error resuming play after pause:`, err);
          });
        }
      }, 200); // Short delay before resuming
    }
  }, [onPause, clearWaitingTimeout, isMobile, isIntersecting, videoRef, componentId]);

  const handleWaitingInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    logger.warn(`[${componentId}] onWaiting event fired.`);
    clearWaitingTimeout(); // Clear previous waiting timeout
    waitingTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && videoRef.current.readyState < 3 && !videoRef.current.paused && !error && !unmountedRef.current) { // readyState < 3 means not enough data
         logger.warn(`[${componentId}] Waiting timeout expired, video still buffering.`);
         attemptReset();
      } else {
         logger.log(`[${componentId}] Waiting timeout expired, but video state changed (loaded, paused, errored, or unmounted). No reset needed.`);
      }
    }, dynamicTimeoutMs);
    if (onWaitingProp) onWaitingProp(event);
  }, [onWaitingProp, clearWaitingTimeout, attemptReset, error, videoRef, componentId, dynamicTimeoutMs]);

  // --- Ended Event Handler ---
  const handleEndedInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    logger.log(`[${componentId}] onEnded event fired.`);

    // Forward to consumer if they provided a handler
    if (onEnded) onEnded(event);

    if (!videoRef.current || unmountedRef.current) return;

    // If the video should loop (loop prop true) the browser will normally handle it, but there are
    // scenarios on mobile where the loop attribute might have changed dynamically while the video
    // was already playing. Additionally, if the video is still visible (intersecting) on mobile we
    // want to keep it playing even when the loop attribute is false.
    const shouldManuallyLoop = loop || (isMobile && isIntersecting);

    if (shouldManuallyLoop) {
      try {
        videoRef.current.currentTime = 0;
        // Play returns a promise – ignore the rejection here because user interaction
        // requirements have already been satisfied if the video just ended.
        videoRef.current.play().catch(err => {
          logger.error(`[${componentId}] Error attempting to replay video after end:`, err);
        });
      } catch (err) {
        logger.error(`[${componentId}] Failed to reset and replay video after end:`, err);
      }
    }
  }, [onEnded, loop, isMobile, isIntersecting, videoRef, componentId]);

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
          (effectivePreventLoadingFlicker && (!posterLoaded && !initialFrameLoaded && !error && isLoading)) ? 'opacity-0' : 'opacity-100'
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
        onEnded={handleEndedInternal}
        onError={handleVideoError}
        onLoadStart={onLoadStart}
        onPause={handlePauseInternal}
        onPlay={handlePlayInternal}
        onPlaying={onPlaying}
        onProgress={onProgress}
        onSeeked={onSeeked}
        onSeeking={onSeeking}
        onWaiting={handleWaitingInternal}
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
