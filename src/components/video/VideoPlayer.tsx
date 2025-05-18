import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
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
import Hls, { ErrorData, Events as HlsEvents, HlsConfig } from 'hls.js';

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
  const hlsInstanceRef = useRef<Hls | null>(null);

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
  const [isInternallyHovering, setIsInternallyHovering] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [forcedPlay, setForcedPlay] = useState(false);
  const unmountedRef = useRef(false);
  const [initialFrameLoaded, setInitialFrameLoaded] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [videoPlayerIsLoading, setVideoPlayerIsLoading] = useState(true);

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
  
  useEffect(() => {
    if (triggerPlay && localVideoRef?.current?.paused && !unmountedRef.current) {
      localVideoRef.current.play().catch(err => logger.error(`[${componentId}] Error via triggerPlay:`, err));
    }
  }, [triggerPlay, componentId]);
  
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
    return () => {
      unmountedRef.current = true;
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    if (externallyControlled && isHovering && isMobile && !playAttempted && !uVLIsLoading && localVideoRef.current && !unmountedRef.current) {
      setForcedPlay(true);
      localVideoRef.current.play().catch(err => logger.error('Failed to force play mobile lightbox:', err));
    }
  }, [externallyControlled, isHovering, isMobile, playAttempted, uVLIsLoading, componentId]);
  
  useEffect(() => {
    if (isMobile && poster) {
      setPosterLoaded(true);
      return;
    }
    if (poster) {
      const img = new Image();
      img.onload = () => { if (!unmountedRef.current) setPosterLoaded(true); };
      img.onerror = () => { if (!unmountedRef.current) setPosterLoaded(false); };
      img.src = poster;
    } else {
      setPosterLoaded(false);
    }
  }, [poster, isMobile]);
  
  const loadFullVideo = useCallback(() => {
    if (!hasInteracted && !unmountedRef.current) setHasInteracted(true);
  }, [hasInteracted]);

  const handleMouseEnter = () => { if (!isMobile && !unmountedRef.current) { loadFullVideo(); setIsInternallyHovering(true); } };
  const handleMouseLeave = () => { if (!unmountedRef.current) setIsInternallyHovering(false); };

  const handleVideoClick = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    if (onClick) onClick(event);
    else if (!controls && !isMobile && localVideoRef.current) {
      localVideoRef.current.paused ? localVideoRef.current.play().catch(logger.error) : localVideoRef.current.pause();
    }
    if (!hasInteracted) setHasInteracted(true);
  }, [onClick, controls, isMobile, hasInteracted, componentId]);

  const effectivePreventLoadingFlicker = isMobile ? false : preventLoadingFlicker;
  const showLoadingIndicator = (uVLIsLoading || videoPlayerIsLoading) && (!effectivePreventLoadingFlicker || !poster) && !uVLError;

  const effectivePreload = showFirstFrameAsPoster ? 'metadata' : (preloadProp || 'auto');
  const effectiveAutoPlay = autoPlay;

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

  const handleVideoElementError = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    if (unmountedRef.current) return;
    setVideoPlayerIsLoading(false);
      const videoElement = event.currentTarget;
    let errorMessage = 'Unknown video error';
      if (videoElement.error) {
        switch (videoElement.error.code) {
        case MediaError.MEDIA_ERR_ABORTED: errorMessage = 'Playback aborted.'; break;
        case MediaError.MEDIA_ERR_NETWORK: errorMessage = 'Network error.'; break;
        case MediaError.MEDIA_ERR_DECODE: errorMessage = 'Decoding error.'; break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMessage = 'Source not supported.'; break;
        default: errorMessage = `Error: ${videoElement.error.message} (Code: ${videoElement.error.code})`;
      }
    }
    logger.error(`[${componentId}] Video Element Error:`, errorMessage, event);
    if (onError) onError(errorMessage);
  }, [onError, componentId]);

  const preloadObserverOptions = useMemo(() => ({ rootMargin: preloadMargin, threshold: 0 }), [preloadMargin]);
  const isInPreloadArea = useIntersectionObserver(containerRef, preloadObserverOptions);
  useEffect(() => { if (onEnterPreloadArea && !unmountedRef.current) onEnterPreloadArea(isInPreloadArea); }, [isInPreloadArea, onEnterPreloadArea]);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
  }, []);

  const actualPerformReset = useCallback(() => {
    const video = localVideoRef.current;
    if (!video || unmountedRef.current) return;

    logger.warn(`[${componentId}] Performing actual video reset. Attempt: ${retryAttempt + 1}.`);
    setVideoPlayerIsLoading(true);

    if (hlsInstanceRef.current) {
      logger.log(`[${componentId}] Resetting with HLS. Destroying & relying on HLS useEffect to re-init.`);
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
      if (onError) onError(null);
      uVLHandleRetry(); 
    } else {
      logger.log(`[${componentId}] Standard video reset.`);
    const currentTime = video.currentTime;
      const currentSrc = src;
      if (video.currentSrc !== currentSrc && !(currentSrc.endsWith('.m3u8') || currentSrc.includes('.m3u8?'))) {
         video.src = currentSrc;
      }
      video.load();
    video.play().then(() => {
        if (!unmountedRef.current && localVideoRef.current) {
          if (localVideoRef.current.currentTime === 0 && currentTime > 0) localVideoRef.current.currentTime = currentTime;
          setRetryAttempt(0); 
          clearRetryTimeout(); 
          setVideoPlayerIsLoading(false);
        }
    }).catch(err => {
        if (!unmountedRef.current) {
          logger.error(`[${componentId}] Error playing after standard reset (Attempt ${retryAttempt + 1}):`, err);
          if (onError) onError(err.message || 'Error playing after reset');
          setRetryAttempt(prev => prev + 1);
          setVideoPlayerIsLoading(false);
        }
      });
    }
  }, [src, retryAttempt, clearRetryTimeout, uVLHandleRetry, onError, componentId]);

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
    setHasPlayedOnce(true);
    setRetryAttempt(0);
    clearRetryTimeout();
    if (onPlayProp) onPlayProp(event);
  }, [onPlayProp, clearRetryTimeout, componentId]);

  const handlePauseInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = localVideoRef.current;
    if (video && (video.ended || !isIntersecting || !isMobile)) clearRetryTimeout();
    if (onPause) onPause(event);
    if (isMobile && isIntersecting && video && !video.ended && !unmountedRef.current) {
      setTimeout(() => {
        if (localVideoRef.current?.paused && isIntersecting && !localVideoRef.current.ended && !unmountedRef.current) {
          localVideoRef.current.play().catch(logger.error);
        }
      }, 200);
    }
  }, [onPause, clearRetryTimeout, isMobile, isIntersecting, componentId]);

  const handleWaitingInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    scheduleNextVideoRetry(); 
    if (onWaitingProp) onWaitingProp(event);
  }, [onWaitingProp, scheduleNextVideoRetry, componentId]);

  const handleEndedInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (onEnded) onEnded(event);
    if (!localVideoRef.current || unmountedRef.current) return;
    const shouldManuallyLoop = loop || (isMobile && isIntersecting);
    if (shouldManuallyLoop) {
        localVideoRef.current.currentTime = 0;
      localVideoRef.current.play().catch(logger.error);
    }
  }, [onEnded, loop, isMobile, isIntersecting, componentId]);

  useEffect(() => () => {
    if (ref && typeof ref === 'function') ref(null);
    else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<HTMLVideoElement | null>).current = null;
  }, [ref]);

  useEffect(() => {
    const videoEl = localVideoRef.current;
    const isHlsSrc = src && (src.endsWith('.m3u8') || src.includes('.m3u8?'));

    if (!isHlsSrc) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      return;
    }

    if (!videoEl) return;

    const nativeHlsSupport = videoEl.canPlayType('application/vnd.apple.mpegURL') || videoEl.canPlayType('application/x-mpegURL');
    if (nativeHlsSupport) {
      if (hlsInstanceRef.current) { hlsInstanceRef.current.destroy(); hlsInstanceRef.current = null; }
      return; 
    }

    if (!Hls.isSupported()) {
      if (onError) onError('Hls.js is not supported');
      return;
    }

    if (hlsInstanceRef.current && hlsInstanceRef.current.url !== src) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }
    
    if (!hlsInstanceRef.current) {
        if (videoEl.getAttribute('src')) {
            videoEl.removeAttribute('src');
            videoEl.load(); 
        }
        const hlsConfig: Partial<HlsConfig> = { 
          enableWorker: false,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferHole: 0.8,
          maxBufferLength: 40,
          fragLoadingTimeOut: 30000,
          manifestLoadingTimeOut: 20000,
          liveDurationInfinity: true,
          liveBackBufferLength: 30,
          maxBufferSize: 30 * 1000 * 1000,
          maxMaxBufferLength: 120,
          highBufferWatchdogPeriod: 2,
          nudgeMaxRetry: 5,
        };
        const newHls = new Hls(hlsConfig);
        hlsInstanceRef.current = newHls;
        newHls.attachMedia(videoEl);
        newHls.on(HlsEvents.MEDIA_ATTACHED, () => {
          newHls.loadSource(src);
          setVideoPlayerIsLoading(false); 
        });
        newHls.on(HlsEvents.ERROR, (_evt, data: ErrorData) => {
          setVideoPlayerIsLoading(false);
          let message = `HLS: ${data.details || data.type}`;
          if (data.fatal) message = `Fatal HLS: ${data.details || data.type}`;
          
          // Accessing frag properties requires checking if data.frag exists and is of the expected type
          const frag = data.frag;
          if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR && !data.fatal && frag && typeof (frag as any).maxRetry === 'number' && (frag as any).numRetry < (frag as any).maxRetry) {
            return; 
          }
          if (onError) onError(message);
          logger.error(`[${componentId}] HLS.js Error: ${message}`, data.error || '');
        });
        newHls.on(HlsEvents.MANIFEST_LOADED, () => setVideoPlayerIsLoading(false));
        newHls.on(HlsEvents.LEVEL_LOADED, () => setVideoPlayerIsLoading(false));
    } 
    return () => {};
  }, [src, onError, componentId]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden rounded-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-is-mobile={isMobile ? "true" : "false"}
    >
      {showLoadingIndicator && <VideoLoader posterImage={poster} />}
      
      {uVLError && !onError && ( 
        <VideoError 
          error={uVLError} 
          errorDetails={uVLErrorDetails || undefined} 
          onRetry={uVLHandleRetry}
          videoSource={src}
        />
      )}
      
      <VideoOverlay isMobile={isMobile && !externallyControlled} poster={poster} posterLoaded={posterLoaded} />
      <LazyPosterImage poster={poster} lazyLoad={lazyLoad} hasInteracted={hasInteracted || externallyControlled} isMobile={isMobile && !externallyControlled}/>
      
      <video
        ref={setVideoRef}
        className={cn(
          "w-full h-full object-cover rounded-md transition-opacity duration-300",
          className,
           (effectivePreventLoadingFlicker && (!posterLoaded && !initialFrameLoaded && !uVLError && (uVLIsLoading || videoPlayerIsLoading))) ? 'opacity-0' : 'opacity-100'
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
