import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { Play } from 'lucide-react';
import Hls from 'hls.js';
import VideoError from './VideoError';
import VideoLoader from './VideoLoader';
import VideoOverlay from './VideoOverlay';
import LazyPosterImage from './LazyPosterImage';
import { useVideoLoader } from '@/hooks/useVideoLoader';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useHlsIntegration } from '@/hooks/useHlsIntegration';
import { useVideoPlaybackManager } from '@/contexts/VideoPlaybackContext';

const logger = new Logger('VideoPlayer');
const videoPlayerLogger = (id: string, ...args: any[]) => console.log(`[VideoPlayer:${id}]`, ...args);

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
  onError?: (message: string | null) => void;
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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [videoPlayerIsLoading, setVideoPlayerIsLoading] = useState(true);

  // States and callbacks that might be used by error handlers or reset logic
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unmountedRef = useRef(false);
  const [isInternallyHovering, setIsInternallyHovering] = useState(false);

  const { registerMobileVideo, unregisterMobileVideo, updateVideoPreference } = useVideoPlaybackManager();
  const videoId = componentId; // Use componentId as videoId for the context

  const {
    error: uVLError,
    isLoading: uVLIsLoading,
    errorDetails: uVLErrorDetails,
    handleRetry: uVLHandleRetry,
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

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
  }, []);

  // Forward declaration for HLS error handler via ref
  const handleHlsErrorRef = useRef<((hlsMessage: string | null) => void) | null>(null);

  // HLS Integration - gets a wrapper for onError
  const { hlsInstanceRef } = useHlsIntegration({
    src,
    videoRef: localVideoRef,
    onError: (message) => handleHlsErrorRef.current?.(message),
    setLoading: setVideoPlayerIsLoading,
    componentId,
  });

  // Definition of actualPerformReset
  const actualPerformReset = useCallback(() => {
    const video = localVideoRef.current;
    if (!video || unmountedRef.current) return;

    logger.warn(`[VideoMobileError][${componentId}] Performing actual video reset. Attempt: ${retryAttempt + 1}.`);
    videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] Entering actualPerformReset. Retry attempt: ${retryAttempt + 1}`);
    setVideoPlayerIsLoading(true);

    if (hlsInstanceRef.current) {
      logger.log(`[VideoMobileError][${componentId}] Resetting with HLS. Destroying & relying on HLS useEffect to re-init.`);
      videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] HLS instance present. Destroying HLS for reset.`);
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
      if (onError) onError(null);
      uVLHandleRetry(); // This might re-trigger HLS setup via useHlsIntegration's useEffect on src
      videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] HLS reset initiated. uVLHandleRetry called.`);
    } else {
      logger.log(`[VideoMobileError][${componentId}] Standard video reset.`);
      videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] Standard video reset. Current src: ${video.currentSrc}, target src prop: ${src}`);
      const currentTime = video.currentTime;
      const currentSrc = src; // src prop
      if (video.currentSrc !== currentSrc && !(currentSrc.endsWith('.m3u8') || currentSrc.includes('.m3u8?'))) {
        videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] Setting video.src to: ${currentSrc}`);
        video.src = currentSrc;
      }
      videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] Calling video.load()`);
      video.load();
      videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] Calling video.play()`);
      video.play().then(() => {
        if (!unmountedRef.current && localVideoRef.current) {
          if (localVideoRef.current.currentTime === 0 && currentTime > 0) {
            videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] Play successful, restoring currentTime to ${currentTime}`);
            localVideoRef.current.currentTime = currentTime;
          }
          setRetryAttempt(0);
          clearRetryTimeout();
          setVideoPlayerIsLoading(false);
          logger.log(`[VideoMobileError][${componentId}] Standard video reset successful.`);
          videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] Standard video reset play successful.`);
        }
      }).catch(err => {
        if (!unmountedRef.current) {
          logger.error(`[VideoMobileError][${componentId}] Error playing after standard reset (Attempt ${retryAttempt + 1}):`, err);
          videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] Error playing after standard reset (Attempt ${retryAttempt + 1}):`, err.name, err.message);
          if (onError) {
            logger.log(`[VideoMobileError][${componentId}] Propagating error to parent after standard reset failure.`);
            onError(err.message || 'Error playing after reset');
          }
          setRetryAttempt(prev => prev + 1);
          setVideoPlayerIsLoading(false);
        }
      });
    }
  }, [src, retryAttempt, clearRetryTimeout, uVLHandleRetry, onError, componentId, hlsInstanceRef]);

  // Definition of the actual HLS error handler callback
  const handleHlsErrorCallback = useCallback((hlsMessage: string | null) => {
    if (unmountedRef.current) return;
    if (hlsMessage) {
      logger.error(`[VideoMobileError][${componentId}] VideoPlayer received HLS error: ${hlsMessage}`);
      
      const isFatalHlsError = hlsMessage.includes("Fatal HLS:");
      const isHlsNotSupportedError = hlsMessage === 'Hls.js is not supported in this browser';

      if (isFatalHlsError || isHlsNotSupportedError) {
        if (retryAttempt < RETRY_DELAYS_MS.length) {
          logger.warn(`[VideoMobileError][${componentId}] Specific HLS error detected ("${hlsMessage}") requiring retry. Triggering VideoPlayer reset. Attempt: ${retryAttempt + 1}`);
          actualPerformReset();
        } else {
          logger.error(`[VideoMobileError][${componentId}] Max retry attempts reached for HLS error: "${hlsMessage}". Propagating to parent.`);
          if (onError) {
            onError(hlsMessage);
          } else {
            logger.warn(`[VideoMobileError][${componentId}] No onError prop, HLS error "${hlsMessage}" might not be displayed if uVLError is not also set.`);
          }
        }
      } else {
        logger.log(`[VideoMobileError][${componentId}] Non-fatal/non-specific HLS error: "${hlsMessage}". Propagating to parent.`);
        if (onError) {
          onError(hlsMessage);
        } else {
          logger.warn(`[VideoMobileError][${componentId}] No onError prop, HLS error "${hlsMessage}" might not be displayed if uVLError is not also set.`);
        }
      }
    } else {
      logger.log(`[VideoMobileError][${componentId}] HLS error callback with null message. Clearing error with parent.`);
      if (onError) {
        onError(null);
      }
    }
  }, [onError, actualPerformReset, componentId, retryAttempt]);

  // Assign the callback to the ref in an effect
  useEffect(() => {
    handleHlsErrorRef.current = handleHlsErrorCallback;
  }, [handleHlsErrorCallback]);
  
  useEffect(() => {
    // Store ref value for cleanup because localVideoRef.current might be null by then
    const videoElementForCleanup = localVideoRef.current;
    return () => {
      unmountedRef.current = true;
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsInstanceRef]);

  const setVideoRef = (node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (ref) {
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<HTMLVideoElement | null>).current = node;
    }
  };

  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [hasInteracted, setHasInteracted] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [forcedPlay, setForcedPlay] = useState(false);
  const [initialFrameLoaded, setInitialFrameLoaded] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  useEffect(() => {
    if (triggerPlay && localVideoRef?.current?.paused && !unmountedRef.current) {
      const video = localVideoRef.current;
      videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] triggerPlay useEffect. triggerPlay=${triggerPlay}, video.paused=${video?.paused}`);
      if (isMobile && video) {
        logger.log(`[MobileVideoPlay][${componentId}] Setting active via triggerPlay`);
        registerMobileVideo(videoId, video, true);
      }
      videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] triggerPlay: Calling video.play()`);
      video.play().catch(err => {
        logger.error(`[${componentId}] Error via triggerPlay:`, err);
        videoPlayerLogger(componentId, `[VideoPlayInterruptDebug] triggerPlay: Error calling video.play():`, err.name, err.message);
      });
    }
  }, [triggerPlay, componentId, isMobile, registerMobileVideo]);
  
  useVideoPlayback({
    videoRef: localVideoRef,
    externallyControlled: !isMobile && externallyControlled,
    isHovering: externallyControlled ? isHovering : isInternallyHovering,
    muted,
    isMobile,
    loadedDataFired: !uVLIsLoading,
    playAttempted,
    setPlayAttempted,
    forcedPlay,
    componentId
  });
  
  useEffect(() => {
    if (poster) {
      setPosterLoaded(false);
      const img = new Image();
      img.onload = () => {
        if (!unmountedRef.current) setPosterLoaded(true);
      };
      img.onerror = () => {
        if (!unmountedRef.current) {
          setPosterLoaded(true);
          logger.warn(`[${componentId}] Poster image failed to load: ${poster}`);
        }
      };
      img.src = poster;
    } else {
      setPosterLoaded(false);
    }
  }, [poster, componentId]);
  
  const loadFullVideo = useCallback(() => {
    if (!hasInteracted && !unmountedRef.current) setHasInteracted(true);
  }, [hasInteracted]);

  const handleMouseEnter = () => { if (!isMobile && !unmountedRef.current) { loadFullVideo(); setIsInternallyHovering(true); } };
  const handleMouseLeave = () => { if (!unmountedRef.current) setIsInternallyHovering(false); };

  const handleVideoClick = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    if (onClick) onClick(event);
    else if (!controls && localVideoRef.current) {
      const video = localVideoRef.current;
      if (isMobile) {
        if (video.paused) {
          videoPlayerLogger(videoId, 'Video clicked (paused), updating preference to true.');
          updateVideoPreference(videoId, true);
        } else {
          videoPlayerLogger(videoId, 'Video clicked (playing), updating preference to false.');
          updateVideoPreference(videoId, false);
        }
      } else {
        video.paused ? video.play().catch(logger.error) : video.pause();
      }
    }
    if (!hasInteracted) setHasInteracted(true);
  }, [onClick, controls, isMobile, hasInteracted, componentId, videoId, updateVideoPreference]);

  const effectivePreventLoadingFlicker = isMobile ? false : preventLoadingFlicker;
  const showLoadingIndicator = (uVLIsLoading || videoPlayerIsLoading) && (!effectivePreventLoadingFlicker || !poster) && !uVLError;

  const isFirefox = typeof navigator !== 'undefined' && /Firefox/.test(navigator.userAgent);
  const isHls = src.endsWith('.m3u8') || src.includes('.m3u8?');
  const effectivePreload = (showFirstFrameAsPoster || (isFirefox && isHls)) ? 'metadata' : (preloadProp || 'auto');
  const effectiveAutoPlay = !isMobile && autoPlay;

  const handleLoadedDataInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event> | Event) => {
    if (localVideoRef.current && showFirstFrameAsPoster && !initialFrameLoaded) {
      localVideoRef.current.pause();
      localVideoRef.current.currentTime = 0;
      setInitialFrameLoaded(true);
    }
    if (onLoadedData) onLoadedData(event);
  }, [showFirstFrameAsPoster, initialFrameLoaded, onLoadedData, componentId]);

  const effectiveIntersectionOptions = useMemo(() => (isMobile ? { rootMargin: '0px', threshold: 0 } : intersectionOptions), [isMobile, intersectionOptions]);
  const isIntersecting = useIntersectionObserver(containerRef, effectiveIntersectionOptions);

  useEffect(() => { if (onVisibilityChange && !unmountedRef.current) onVisibilityChange(isIntersecting); }, [isIntersecting, onVisibilityChange]);

  const shouldShowPoster = poster && !(showFirstFrameAsPoster && initialFrameLoaded);

  const handleLoadedMetadataInternal = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (showFirstFrameAsPoster && localVideoRef.current?.paused && localVideoRef.current.readyState >= 1 && !initialFrameLoaded) {
      localVideoRef.current.currentTime = 0;
    }
    if (onLoadedMetadata) onLoadedMetadata(e);
  };

  const preloadObserverOptions = useMemo(() => ({ rootMargin: preloadMargin, threshold: 0 }), [preloadMargin]);
  const isInPreloadArea = useIntersectionObserver(containerRef, preloadObserverOptions);
  useEffect(() => { if (onEnterPreloadArea && !unmountedRef.current) onEnterPreloadArea(isInPreloadArea); }, [isInPreloadArea, onEnterPreloadArea]);

  const scheduleNextVideoRetry = useCallback(() => {
    clearRetryTimeout();
    if (uVLError || unmountedRef.current) return;
    if (retryAttempt >= RETRY_DELAYS_MS.length) {
      logger.error(`[${componentId}] Max retry attempts reached.`);
      return;
    }
    const delay = RETRY_DELAYS_MS[retryAttempt];
    retryTimeoutRef.current = setTimeout(() => {
      const video = localVideoRef.current;
      if (video && !unmountedRef.current && (video.paused || video.readyState < 3) && !uVLError ) {
        actualPerformReset();
      } else {
         logger.log(`[${componentId}] Retry expired, conditions not met for reset. uVLError: ${!!uVLError}`);
      }
    }, delay);
  }, [retryAttempt, uVLError, clearRetryTimeout, actualPerformReset, componentId]);

  // ---------------------------------------------------------------------------
  // Error handler – attempt automatic recovery on decode errors
  // ---------------------------------------------------------------------------
  const handleVideoElementError = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    if (unmountedRef.current) return;

    const videoElement = event.currentTarget;
    let errorMessage = 'Unknown video error';
    let errorDetails = videoElement.error?.message || 'No additional details from video element.';
    let isDecodeError = false;
    let isAbortError = false;
    let isSrcNotSupportedError = false;

    if (videoElement.error) {
      switch (videoElement.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Playback aborted by user or script.';
          isAbortError = true;
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'A network error caused the video download to fail part-way.';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support.';
          isDecodeError = true;
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'The video could not be loaded, either because the server or network failed or because the format is not supported.';
          isSrcNotSupportedError = true;
          break;
        default:
          errorMessage = `An unexpected error occurred with the video (Code: ${videoElement.error.code})`;
      }
    }

    logger.error(`[VideoMobileError][${componentId}] Video Element Error:`, { message: errorMessage, details: errorDetails, originalEvent: event });

    // If a decoding, abort, or src_not_supported error occurs, try to recover automatically.
    if ((isDecodeError || isAbortError || isSrcNotSupportedError) && retryAttempt < RETRY_DELAYS_MS.length) {
      let errorType = isDecodeError ? 'decoding' : isAbortError ? 'abort' : 'source not supported';
      logger.warn(`[VideoMobileError][${componentId}] Attempting automatic recovery from ${errorType} error (retry ${retryAttempt + 1}).`);
      actualPerformReset();
      return; // Skip propagating the error – we'll retry instead.
    }

    // For non-recoverable errors, surface them to any parent handler.
    setVideoPlayerIsLoading(false);
    if (onError) {
      logger.log(`[VideoMobileError][${componentId}] Propagating video element error to parent: ${errorMessage}`);
      onError(errorMessage); // Consider passing errorDetails here too if the parent can use it
    } else {
      // This case should be handled by uVLError from useVideoLoader if it also catches this error
      logger.warn(`[VideoMobileError][${componentId}] No onError prop for video element error: ${errorMessage}. Relies on uVLError.`);
    }
  }, [onError, componentId, actualPerformReset, retryAttempt]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video || hasPlayedOnce || uVLError || unmountedRef.current || !video.paused) {
      clearRetryTimeout(); return;
    }
    const shouldAttemptPlayLogic = (isIntersecting && isMobile) || (!isMobile && playAttempted);
    if (shouldAttemptPlayLogic) scheduleNextVideoRetry();
    else clearRetryTimeout();
  }, [isIntersecting, isMobile, hasPlayedOnce, uVLError, playAttempted, scheduleNextVideoRetry, clearRetryTimeout, componentId]);

  const handlePlayInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (isMobile && !unmountedRef.current) {
      videoPlayerLogger(videoId, 'onPlay event, updating preference to true.');
      updateVideoPreference(videoId, true);
    }
    setHasPlayedOnce(true);
    setRetryAttempt(0);
    clearRetryTimeout();
    if (onPlayProp) onPlayProp(event);
  }, [onPlayProp, clearRetryTimeout, componentId, isMobile, updateVideoPreference, videoId]);

  const handlePauseInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = localVideoRef.current;
    if (video && (video.ended || !isIntersecting || !isMobile)) clearRetryTimeout();
    
    if (isMobile && !unmountedRef.current && video) {
      if (!(video.ended && loop)) {
        videoPlayerLogger(videoId, 'onPause event, updating preference to false (unless ended and looping).');
        updateVideoPreference(videoId, false);
      }
    }

    if (onPause) onPause(event);

  }, [onPause, clearRetryTimeout, isMobile, isIntersecting, componentId, updateVideoPreference, videoId, loop]);

  const handleWaitingInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    scheduleNextVideoRetry(); 
    if (onWaitingProp) onWaitingProp(event);
  }, [onWaitingProp, scheduleNextVideoRetry, componentId]);

  const handleEndedInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (onEnded) onEnded(event);
    if (!localVideoRef.current || unmountedRef.current) return;
    const video = localVideoRef.current;

    if (loop) {
      if (isMobile) {
        videoPlayerLogger(videoId, 'Video ended, loop=true. Resetting time and updating preference to play.');
        if (video) video.currentTime = 0;
        updateVideoPreference(videoId, true);
      } else {
        videoPlayerLogger(videoId, 'Video ended, loop=true on non-mobile. Playing directly.');
        if (video) video.currentTime = 0;
        video?.play().catch(logger.error);
      }
    } else if (isMobile) {
      videoPlayerLogger(videoId, 'Video ended, loop=false. Updating preference to not play.');
      updateVideoPreference(videoId, false);
    }
  }, [onEnded, loop, isMobile, componentId, videoId, updateVideoPreference]);

  useEffect(() => () => {
    if (ref && typeof ref === 'function') ref(null);
    else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<HTMLVideoElement | null>).current = null;
  }, [ref]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden rounded-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-is-mobile={isMobile ? "true" : "false"}
      data-component-id={componentId}
    >
      {showLoadingIndicator && <VideoLoader posterImage={poster} />}
      
      {uVLError && !onError && 
        (() => {
          // Log when VideoPlayer is handling its own error display
          logger.log(`[VideoMobileError][${componentId}] VideoPlayer rendering internal VideoError due to uVLError: ${uVLError}. Details: ${uVLErrorDetails}`);
          return (
            <VideoError 
              error={uVLError} 
              errorDetails={uVLErrorDetails || undefined} 
              onRetry={uVLHandleRetry}
              videoSource={src}
            />
          );
        })()
      }
      
      <VideoOverlay isMobile={isMobile && !externallyControlled} poster={poster} posterLoaded={posterLoaded} />
      <LazyPosterImage
        poster={poster}
        lazyLoad={poster ? false : lazyLoad}
        hasInteracted={hasInteracted || externallyControlled}
        isMobile={isMobile && !externallyControlled}
      />
      
      <video
        ref={setVideoRef}
        className={cn(
          "w-full h-full object-cover rounded-md transition-opacity duration-300",
          className,
           (
            effectivePreventLoadingFlicker &&
            poster &&
            !posterLoaded &&
            !initialFrameLoaded &&
            !uVLError &&
            (uVLIsLoading || videoPlayerIsLoading)
          ) ? 'opacity-0' : 'opacity-100'
        )}
        autoPlay={effectiveAutoPlay}
        muted={muted}
        loop={!isMobile && loop}
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
        onError={handleVideoElementError}
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
      
      {(!uVLIsLoading && !videoPlayerIsLoading || ( (uVLIsLoading || videoPlayerIsLoading) && poster && posterLoaded)) && !uVLError && showPlayButtonOnHover && !isMobile && isInternallyHovering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 opacity-0 hover:opacity-100 pointer-events-none">
          <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
            <Play className="h-8 w-8 text-white" fill="white" />
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
