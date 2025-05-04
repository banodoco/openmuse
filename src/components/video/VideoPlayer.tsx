import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
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

// Define retry delays in milliseconds
const RETRY_DELAYS_MS = [2500, 5000, 10000];

/**
 * Decide an appropriate timeout based on the Network Information API.
 * Returns a value in milliseconds.
 */
/*
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
*/

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  triggerPlay?: boolean;
  playsInline?: boolean;
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

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>((
  {
    src,
    autoPlay = false,
    triggerPlay = false,
    playsInline = true,
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
  },
  ref
) => {
  const componentId = useRef(`video_player_${Math.random().toString(36).substring(2, 9)}`).current;
  logger.log(`[${componentId}] Rendering. src: ${src?.substring(0,30)}..., poster: ${!!poster}, lazyLoad: ${lazyLoad}, preventLoadingFlicker: ${preventLoadingFlicker}`);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const setVideoRef = (node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<HTMLVideoElement | null>).current = node;
      }
    }
  };

  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isInternallyHovering, setIsInternallyHovering] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [forcedPlay, setForcedPlay] = useState(false);
  const unmountedRef = useRef(false);
  const [initialFrameLoaded, setInitialFrameLoaded] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  
  // State for retry logic
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    videoRef: localVideoRef,
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
    if (triggerPlay && localVideoRef?.current && localVideoRef.current.paused && !unmountedRef.current) {
      logger.log(`[${componentId}] triggerPlay is true, attempting to play.`);
      localVideoRef.current.play().catch(err => {
        logger.error(`[${componentId}] Error attempting to play via triggerPlay:`, err);
      });
    }
  }, [triggerPlay, localVideoRef]);
  
  useVideoPlayback({
    videoRef: localVideoRef,
    externallyControlled: !isMobile && externallyControlled,
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
    if (externallyControlled && isHovering && isMobile && !playAttempted && !isLoading && localVideoRef.current && !unmountedRef.current) {
      logger.log('Forcing play for lightbox on mobile');
      setForcedPlay(true);
      
      const attemptPlay = async () => {
        try {
          if (localVideoRef.current && !unmountedRef.current) {
            await localVideoRef.current.play();
            logger.log('Successfully forced play on mobile lightbox');
          }
        } catch (err) {
          logger.error('Failed to force play on mobile lightbox:', err);
        }
      };
      
      attemptPlay();
    }
  }, [externallyControlled, isHovering, isMobile, playAttempted, isLoading, localVideoRef]);
  
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

  const handleVideoClick = useCallback(
    (event: React.MouseEvent<HTMLVideoElement>) => {
      if (onClick) {
        onClick(event);
      } else if (!controls && !isMobile && localVideoRef?.current) {
        if (localVideoRef.current.paused) {
          localVideoRef.current.play().catch(err => logger.error(`[${componentId}] Error playing on click:`, err));
        } else {
          localVideoRef.current.pause();
        }
      }
      if (!hasInteracted) {
        setHasInteracted(true);
      }
    },
    [onClick, controls, isMobile, localVideoRef, hasInteracted, componentId]
  );

  const effectivePreventLoadingFlicker = isMobile ? false : preventLoadingFlicker;
  const shouldShowLoading = !isMobile && isLoading && (!effectivePreventLoadingFlicker || !poster);
  logger.log(`[${componentId}] State: isLoading=${isLoading}, error=${!!error}, hasInteracted=${hasInteracted}, posterLoaded=${posterLoaded}, externallyControlled=${externallyControlled}`);
  logger.log(`[${componentId}] Visibility: shouldShowLoading=${shouldShowLoading}, videoOpacity=${(lazyLoad && poster && !hasInteracted && !externallyControlled) ? 0 : 1}`);

  const effectivePreload = showFirstFrameAsPoster ? 'metadata' : (preloadProp || 'auto');
  const effectiveAutoPlay = autoPlay;

  const handleLoadedDataInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event> | Event) => {
    logger.log(`[${componentId}] onLoadedData triggered. showFirstFrameAsPoster: ${showFirstFrameAsPoster}, initialFrameLoaded: ${initialFrameLoaded}`);
    if (localVideoRef.current && showFirstFrameAsPoster && !initialFrameLoaded) {
      logger.log(`[${componentId}] Pausing on first frame.`);
      localVideoRef.current.pause();
      localVideoRef.current.currentTime = 0;
      setInitialFrameLoaded(true);
    }
    if (onLoadedData) {
      onLoadedData(event);
    }
  }, [showFirstFrameAsPoster, initialFrameLoaded, onLoadedData, localVideoRef, componentId]);

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
    logger.log(`[${componentId}] Loaded metadata. Duration: ${localVideoRef?.current?.duration}`);
    if (showFirstFrameAsPoster && localVideoRef?.current && localVideoRef.current.paused && localVideoRef.current.readyState >= 1 /* HAVE_METADATA */ ) {
        // Sometimes loadeddata doesn't fire at time 0, especially with preload='metadata'
        // We try to force seeking to 0 to capture the first frame if needed
        if (!initialFrameLoaded) {
           logger.log(`[${componentId}] Metadata loaded, seeking to 0 for first frame poster.`);
           localVideoRef.current.currentTime = 0; // Seek to beginning
        }
    }
    if (onLoadedMetadata) onLoadedMetadata(e);
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
    // REMOVED: Automatic play call on intersection for mobile causes NotAllowedError
    // if (isIntersecting && isMobile && videoRef.current && videoRef.current.paused && !unmountedRef.current) {
    //   logger.log(`[${componentId}] Mobile intersection detected, attempting autoplay.`);
    //   videoRef.current.play().catch(err => {
    //     logger.error(`[${componentId}] Mobile autoplay failed:`, err);
    //   });
    // }
  }, [isIntersecting, isMobile, localVideoRef]);

  // --- Retry Timeout Logic ---
  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
      // logger.log(`[${componentId}] Cleared retry timeout.`);
    }
  }, []);

  // Function to perform the actual video reset action
  const performActualReset = useCallback(() => {
    const video = localVideoRef.current;
    if (!video || unmountedRef.current || error) {
      logger.warn(`[${componentId}] performActualReset called but conditions not met (video: ${!!video}, unmounted: ${unmountedRef.current}, error: ${!!error})`);
      return;
    }

    logger.warn(`[${componentId}] Performing video reset. Attempt: ${retryAttempt + 1}. Current time: ${video.currentTime}, Ready state: ${video.readyState}, Paused: ${video.paused}`);
    
    const currentTime = video.currentTime;
    video.load(); // Force reload of the video source
    video.play().then(() => {
      // Restore position slightly after play starts
      setTimeout(() => {
        if (localVideoRef.current && !unmountedRef.current) {
          if (video.currentTime === 0 && currentTime > 0) {
             video.currentTime = currentTime;
             logger.log(`[${componentId}] Reset successful, restored time to ${currentTime}`);
          } else {
             logger.log(`[${componentId}] Reset play successful, current time is now ${video.currentTime}`);
          }
          // Successfully played after reset, clear future retries for this specific stall
          setRetryAttempt(0); 
          clearRetryTimeout(); 
        }
      }, 100);
    }).catch(err => {
      if (err.name !== 'NotAllowedError') {
         logger.error(`[${componentId}] Error playing after reset (Attempt ${retryAttempt + 1}):`, err);
      } else {
         logger.warn(`[${componentId}] Autoplay prevented after reset (Attempt ${retryAttempt + 1}).`);
      }
      // IMPORTANT: Schedule the *next* retry attempt even if play fails here, 
      // as the failure might be temporary (e.g., interaction needed).
      // The 'waiting' or initial play logic will handle rescheduling if the video remains stuck.
      // However, we increment the attempt count *before* scheduling the next one via 'waiting' or initial play.
      setRetryAttempt(prev => prev + 1); // Increment for the next potential trigger
    });
  }, [localVideoRef, componentId, error, retryAttempt, clearRetryTimeout]); // Added retryAttempt and clearRetryTimeout

  // Function to schedule the next retry attempt
  const scheduleNextRetry = useCallback(() => {
    clearRetryTimeout(); // Clear any existing timeout first

    if (error || unmountedRef.current) {
      logger.log(`[${componentId}] Not scheduling retry: Error exists or component unmounted.`);
      return;
    }

    if (retryAttempt >= RETRY_DELAYS_MS.length) {
      logger.error(`[${componentId}] Maximum retry attempts (${RETRY_DELAYS_MS.length}) reached. Giving up.`);
      // Optionally: Set a specific error state here to indicate persistent failure?
      return;
    }

    const delay = RETRY_DELAYS_MS[retryAttempt];
    logger.warn(`[${componentId}] Video stalled or failed to start. Scheduling retry attempt ${retryAttempt + 1}/${RETRY_DELAYS_MS.length} in ${delay}ms.`);

    retryTimeoutRef.current = setTimeout(() => {
      // Check conditions *again* inside the timeout, state might have changed
      const video = localVideoRef.current;
      if (video && !unmountedRef.current && !error && (video.paused || video.readyState < 3)) {
        logger.log(`[${componentId}] Retry timeout expired. Performing reset action.`);
        performActualReset(); 
        // Note: performActualReset now increments the attempt count if play() fails,
        // preparing for the *next* waiting/initial trigger.
      } else {
        logger.log(`[${componentId}] Retry timeout expired, but video state is now OK (playing, loaded, errored, or unmounted). Reset aborted.`);
        // Reset attempt count if condition resolved itself? Maybe not, let successful play handle it.
      }
    }, delay);

  }, [retryAttempt, localVideoRef, error, clearRetryTimeout, performActualReset, componentId]); // Added dependencies

  // --- Timeout Clearing (Old functions removed) ---
  // const clearInitialPlayTimeout = useCallback(() => { ... }); // REMOVED
  // const clearWaitingTimeout = useCallback(() => { ... }); // REMOVED

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // clearInitialPlayTimeout(); // REMOVED
      // clearWaitingTimeout(); // REMOVED
      clearRetryTimeout(); // Use the new unified clear function
      logger.log(`[${componentId}] Unmounting, cleared timeouts.`);
      unmountedRef.current = true;
    };
  // }, [clearInitialPlayTimeout, clearWaitingTimeout]); // REMOVED
  }, [clearRetryTimeout]); // Updated dependency

  // --- Initial Play Timeout Logic (Modified) ---
  useEffect(() => {
    const video = localVideoRef.current;
    // Need video, not played yet, no error, not unmounted, and video is currently paused
    if (!video || hasPlayedOnce || error || unmountedRef.current || !video.paused) {
      clearRetryTimeout(); // Clear if condition is no longer met
      return;
    }

    const shouldAttemptPlay = (isIntersecting && isMobile) || (!isMobile && playAttempted);

    if (shouldAttemptPlay) {
       logger.log(`[${componentId}] Condition met for initial play/retry check. Attempt: ${retryAttempt}`);
      // Instead of setting a timeout directly, schedule the first retry check.
      // If play succeeds before the timeout, handlePlay will clear it.
      // If it stalls, handleWaiting will take over scheduling subsequent retries.
       scheduleNextRetry();
    } else {
       // If conditions like intersection are no longer met, clear pending retry.
       clearRetryTimeout();
    }

  // }, [isIntersecting, isMobile, videoRef, hasPlayedOnce, error, clearInitialPlayTimeout, attemptReset, componentId, dynamicTimeoutMs, playAttempted]); // Old dependencies
  }, [isIntersecting, isMobile, localVideoRef, hasPlayedOnce, error, playAttempted, scheduleNextRetry, clearRetryTimeout, componentId, retryAttempt]); // Updated dependencies


  // --- Video Event Handlers ---
  const handlePlayInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    logger.log(`[${componentId}] onPlay event fired. Playback successful.`);
    setHasPlayedOnce(true);
    setRetryAttempt(0); // Reset retry count on successful play
    // clearInitialPlayTimeout(); // REMOVED
    // clearWaitingTimeout(); // REMOVED
    clearRetryTimeout(); // Clear any pending retry check
    if (onPlayProp) onPlayProp(event);
  // }, [onPlayProp, clearInitialPlayTimeout, clearWaitingTimeout, componentId]); // Old dependencies
  }, [onPlayProp, clearRetryTimeout, componentId]); // Updated dependencies

  const handlePauseInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    // logger.log(`[${componentId}] onPause event fired.`);
    // clearWaitingTimeout(); // REMOVED
    // Clear retry timeout ONLY if the pause seems intentional (end of video OR not intersecting on mobile)
    // If paused unexpectedly while intersecting on mobile, let the waiting handler/timeout handle it.
    const video = localVideoRef.current;
    if (video && (video.ended || !isIntersecting || !isMobile)) {
       clearRetryTimeout();
       // logger.log(`[${componentId}] Intentional pause or end detected, clearing retry timeout.`);
    } else if (isMobile && isIntersecting) {
       // logger.log(`[${componentId}] Pause while intersecting on mobile, potential stall - NOT clearing retry timeout.`);
    }

    if (onPause) onPause(event);

    // Attempt to resume if paused unexpectedly while visible on mobile (Keep this logic)
    if (isMobile && isIntersecting && video && !video.ended && !unmountedRef.current) {
      logger.log(`[${componentId}] Paused while intersecting on mobile, attempting to resume shortly.`);
      setTimeout(() => {
        if (localVideoRef.current && localVideoRef.current.paused && isIntersecting && !localVideoRef.current.ended && !unmountedRef.current) {
          logger.log(`[${componentId}] Resuming play after pause.`);
          localVideoRef.current.play().catch(err => {
            // Don't reset retry attempts here, let 'waiting' handle failures
            logger.error(`[${componentId}] Error resuming play after pause:`, err);
          });
        }
      }, 200);
    }
  // }, [onPause, clearWaitingTimeout, isMobile, isIntersecting, videoRef, componentId]); // Old dependencies
  }, [onPause, clearRetryTimeout, isMobile, isIntersecting, localVideoRef, componentId]); // Updated dependencies

  const handleWaitingInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    logger.warn(`[${componentId}] onWaiting event fired. Attempt: ${retryAttempt}`);
    // clearWaitingTimeout(); // REMOVED
    // Schedule the next retry attempt based on the current attempt count
    scheduleNextRetry(); 
    if (onWaitingProp) onWaitingProp(event);
  // }, [onWaitingProp, clearWaitingTimeout, attemptReset, error, videoRef, componentId, dynamicTimeoutMs]); // Old dependencies
  }, [onWaitingProp, scheduleNextRetry, componentId, retryAttempt]); // Updated dependencies

  // --- Ended Event Handler ---
  const handleEndedInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    logger.log(`[${componentId}] onEnded event fired.`);

    // Forward to consumer if they provided a handler
    if (onEnded) onEnded(event);

    if (!localVideoRef.current || unmountedRef.current) return;

    // If the video should loop (loop prop true) the browser will normally handle it, but there are
    // scenarios on mobile where the loop attribute might have changed dynamically while the video
    // was already playing. Additionally, if the video is still visible (intersecting) on mobile we
    // want to keep it playing even when the loop attribute is false.
    const shouldManuallyLoop = loop || (isMobile && isIntersecting);

    if (shouldManuallyLoop) {
      try {
        localVideoRef.current.currentTime = 0;
        // Play returns a promise – ignore the rejection here because user interaction
        // requirements have already been satisfied if the video just ended.
        localVideoRef.current.play().catch(err => {
          logger.error(`[${componentId}] Error attempting to replay video after end:`, err);
        });
      } catch (err) {
        logger.error(`[${componentId}] Failed to reset and replay video after end:`, err);
      }
    }
  }, [onEnded, loop, isMobile, isIntersecting, localVideoRef, componentId]);

  // Cleanup function to nullify the ref if necessary
  useEffect(() => {
    return () => {
      if (ref && typeof ref === 'function') {
        ref(null);
      } else if (ref && typeof ref === 'object') {
        (ref as React.MutableRefObject<HTMLVideoElement | null>).current = null;
      }
    };
  }, [ref]);

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
        ref={setVideoRef}
        className={cn(
          "w-full h-full object-cover rounded-md transition-opacity duration-300",
          className,
          (effectivePreventLoadingFlicker && (!posterLoaded && !initialFrameLoaded && !error && isLoading)) ? 'opacity-0' : 'opacity-100'
        )}
        autoPlay={effectiveAutoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline={playsInline}
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
});

VideoPlayer.displayName = 'VideoPlayer'; // Add display name for DevTools

export default VideoPlayer;
