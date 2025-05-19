import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import VideoPlayer from './video/VideoPlayer';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const logger = new Logger('StorageVideoPlayer');

interface StorageVideoPlayerProps {
  videoLocation: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playOnHover?: boolean;
  previewMode?: boolean;
  showPlayButtonOnHover?: boolean;
  isHoveringExternally?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onLoadedData?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  thumbnailUrl?: string;
  forcePreload?: boolean;
  isMobile?: boolean;
  preventLoadingFlicker?: boolean;
  allowControlInteraction?: boolean;
  onVisibilityChange?: (isVisible: boolean) => void;
  shouldBePlaying?: boolean;
  onEnterPreloadArea?: (isInPreloadArea: boolean) => void;
  onError?: (message: string) => void;
}

const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
  videoLocation,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  playOnHover = false,
  previewMode = false,
  showPlayButtonOnHover = true,
  isHoveringExternally,
  videoRef: externalVideoRef,
  onLoadedData,
  thumbnailUrl,
  forcePreload = false,
  isMobile = false,
  preventLoadingFlicker = true,
  allowControlInteraction = false,
  onVisibilityChange,
  shouldBePlaying = false,
  onEnterPreloadArea,
  onError,
}) => {
  const componentId = useRef(`storage_video_${Math.random().toString(36).substring(2, 9)}`).current;
  const logPrefix = `[SVP_DEBUG][${componentId}]`;

  // DEBUG LOGGING: Track key props on mobile
  useEffect(() => {
    if (isMobile) {
      logger.log(`${logPrefix} Mobile props update: isMobile=${isMobile}, autoPlay=${autoPlay}, isHoveringExternally=${isHoveringExternally}, shouldBePlaying=${shouldBePlaying}`);
    }
  }, [isMobile, autoPlay, isHoveringExternally, shouldBePlaying]);
  // END DEBUG LOGGING

  // logger.log(`${logPrefix} Rendering. Initial props: thumbnailUrl=${!!thumbnailUrl}, forcePreload=${forcePreload}, autoPlay=${autoPlay}, shouldBePlaying=${shouldBePlaying}`);

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoadingVideoUrl, setIsLoadingVideoUrl] = useState<boolean>(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // Internal hover state, synced with external if provided, otherwise manual
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState<boolean>(() => forcePreload || (isMobile && autoPlay)); // Keep initial load logic
  const [hasHovered, setHasHovered] = useState(forcePreload || (!isMobile && autoPlay)); // Keep initial hasHovered logic
  // This state now primarily reflects the *intent* to play based on props/hover
  const [shouldPlay, setShouldPlay] = useState(false);
  const prevVideoLocationRef = useRef<string | null>(null);
  const [preloadTriggered, setPreloadTriggered] = useState(false);
  // Track whether the component is unmounted so async callbacks can exit early
  const unmountedRef = useRef(false);

  // Helper that centralises the common "should we start loading now?" check so we can
  // reuse it in several effects/callbacks rather than duplicating the same logic.
  const triggerLoadIfNeeded = useCallback(() => {
    if (!shouldLoadVideo && !videoUrl && !error) {
      setShouldLoadVideo(true);
      setHasHovered(true); // Treat as an interaction so thumbnail/play-button logic works
    }
  }, [shouldLoadVideo, videoUrl, error]);

  // Single async function that actually performs the URL resolution / fetch and
  // updates component state. Keeping it in a useCallback means we have a single
  // well-defined place that owns the side-effects, which simplifies the effects
  // below and prevents duplicate calls.
  const startVideoLoad = useCallback(async () => {
    if (unmountedRef.current || !videoLocation) return;

    const isNewVideo = prevVideoLocationRef.current !== videoLocation;
    prevVideoLocationRef.current = videoLocation;

    if (!isNewVideo && videoUrl) {
      // We already have a URL for this location – nothing to do.
      setIsLoadingVideoUrl(false);
      return;
    }

    try {
      setIsLoadingVideoUrl(true);
      setIsVideoLoaded(false);
      setError(null);

      const resolvedUrl = videoLocation.startsWith('blob:')
        ? videoLocation
        : await videoUrlService.getVideoUrl(videoLocation, previewMode);

      if (!resolvedUrl) throw new Error('Could not resolve video URL');

      if (!unmountedRef.current) {
        setVideoUrl(resolvedUrl);
      }
    } catch (err) {
      if (!unmountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Failed to load video: ${message}`);
        setErrorDetails(String(err));
        setIsLoadingVideoUrl(false);
      }
    }
  }, [videoLocation, previewMode]);

  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;

  // Cleanup on unmount
  useEffect(() => {
    // logger.log(`${logPrefix} Mounting effect ran.`);
    return () => {
      // logger.log(`${logPrefix} Unmounting.`);
      unmountedRef.current = true;
    };
  }, []);

  // Effect to sync external hover state and trigger video loading on hover
  useEffect(() => {
    if (isHoveringExternally !== undefined) {
      setIsHovering(isHoveringExternally);

      // If we just started hovering, ensure a load is triggered.
      if (isHoveringExternally) triggerLoadIfNeeded();
    }
    // NOTE: Play decision is handled in the dedicated effect below
  }, [isHoveringExternally, triggerLoadIfNeeded]);

  // Effect to determine if the video should be playing based on props and state
  useEffect(() => {
    if (isMobile && autoPlay) {
      setShouldPlay(true);
      if (!shouldLoadVideo && !videoUrl && !error) {
        setShouldLoadVideo(true);
        setHasHovered(true);
      }
      return;
    }

    // logger.log(`${logPrefix} Play control effect triggered. shouldBePlaying=${shouldBePlaying}, isHovering=${isHovering}, isMobile=${isMobile}, playOnHover=${playOnHover}`);

    if (shouldBePlaying) {
      // logger.log(`${logPrefix} Setting shouldPlay = true because shouldBePlaying is true`);
      setShouldPlay(true);
      // Ensure video loading is also triggered if needed
      if (!shouldLoadVideo && !videoUrl && !error) {
        // logger.log(`${logPrefix} Triggering load because shouldPlay is true and video not loading/loaded`);
        setShouldLoadVideo(true);
        setHasHovered(true); // Treat as "interacted"
      }
    } else {
      // If shouldBePlaying is false, determine play state based on hover (desktop only)
      const playBasedOnHover = playOnHover && isHovering && !isMobile;
      // logger.log(`${logPrefix} Setting shouldPlay based on hover: ${playBasedOnHover}`);
      setShouldPlay(playBasedOnHover);
    }

  }, [shouldBePlaying, isHovering, isMobile, playOnHover, shouldLoadVideo, videoUrl, error]);

  // Effect to handle initial mobile state + forcePreload
  useEffect(() => {
    if (isMobile && forcePreload) {
      // logger.log(`${logPrefix} Mobile + forcePreload: Setting shouldLoadVideo=true, hasHovered=true`);
      setShouldLoadVideo(true);
      setHasHovered(true);
    }
  }, [isMobile, forcePreload]);

  // Handle manual hover events (only trigger load, play logic handled above)
  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined) {
      // logger.log(`${logPrefix} Manual hover start`);
      setIsHovering(true);
      // Trigger loading on hover if not already loading/loaded
      if (!shouldLoadVideo && !videoUrl && !error) {
        // logger.log(`${logPrefix} Triggering load on manual hover start`);
        setShouldLoadVideo(true);
        setHasHovered(true);
      }
    }
  };

  const handleManualHoverEnd = () => {
    if (isHoveringExternally === undefined) {
      // logger.log(`${logPrefix} Manual hover end`);
      setIsHovering(false);
      // Play state will be updated by the dedicated effect based on isHovering=false
    }
  };
  
  // Effect to fetch the video URL *only* when shouldLoadVideo is true
  useEffect(() => {
    if (shouldLoadVideo && !videoUrl && videoLocation && !error) {
      startVideoLoad();
    } else if (videoUrl) {
      // If we already have the URL (e.g., from preload), ensure loading state is false
      setIsLoadingVideoUrl(false);
    }
  }, [videoLocation, retryCount, previewMode, shouldLoadVideo, videoUrl, error, startVideoLoad]);

  // Callback from VideoPlayer when entering/leaving the preload area
  const handleEnterPreloadArea = useCallback((isInPreloadArea: boolean) => {
    if (isInPreloadArea && !preloadTriggered) {
      logger.log(`${logPrefix} Entered preload area. Triggering video load.`);
      setPreloadTriggered(true);
      triggerLoadIfNeeded();
    }
    // We might want logic here if isInPreloadArea becomes false, e.g., cancel loading?
    // For now, just trigger load on first entry.
  }, [preloadTriggered, videoUrl, videoLocation, error]);

  const handleVideoError = (message: string) => {
    if (!unmountedRef.current) {
      // logger.error(`${logPrefix} Video player reported error:`, message);
      setError(message);
      setIsVideoLoaded(false); 
      setIsLoadingVideoUrl(false); // Stop loading state on error
      if (onError) {
        onError(message);
      }
    }
  };

  const handleRetry = () => {
    if (!unmountedRef.current) {
      // logger.log(`${logPrefix} Retrying video load...`);
      setIsLoadingVideoUrl(true); // Indicate loading state during retry
      setError(null);
      setErrorDetails(null);
      setVideoUrl(''); 
      setIsVideoLoaded(false);
      setShouldLoadVideo(true); 
      prevVideoLocationRef.current = null; // Reset the previous video location to force a reload
      setRetryCount(prev => prev + 1);
    }
  };
  
  // Callback when the actual <video> element has loaded data
  const handleVideoLoadedData = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!unmountedRef.current) {
      // logger.log(`${logPrefix} Video loaded data`);
      setIsVideoLoaded(true);
      setIsLoadingVideoUrl(false);
      if (onLoadedData) {
        onLoadedData(event);
      }
    }
  };

  // Handle tap on mobile devices to start loading / playing the video
  const handleMobileTap = () => {
    if (isMobile && !shouldPlay && !unmountedRef.current) {
      // logger.log(`${logPrefix} Mobile tap to load video`);
      setShouldPlay(true);
      setHasHovered(true);
    }
  };

  // Determine visibility states
  const showVideo = !!videoUrl && !error;
  // Show the loading spinner only while the user is interacting (hovering) on desktop.
  // Mobile devices don't have hover, so maintain previous behaviour there.
  const showLoadingSpinner = isLoadingVideoUrl && !error && !isVideoLoaded && (isMobile || isHovering);
  // Always keep thumbnail visible until the video has actually loaded. The
  // previous condition hid it as soon as the user hovered, which resulted in
  // a brief grey flash while the video element was still buffering.
  const showThumbnail = !!thumbnailUrl && !error && (!isVideoLoaded || preventLoadingFlicker);

  // logger.log(`${logPrefix} Visibility states: showThumbnail=${showThumbnail}, showVideo=${showVideo}, showLoadingSpinner=${showLoadingSpinner}, isVideoLoaded=${isVideoLoaded}, hasHovered=${hasHovered}, videoUrl=${!!videoUrl}, error=${!!error}`);

  const onVideoLoadStart = () => {
    if (!unmountedRef.current) {
      // logger.log(`${logPrefix} Video loadStart event triggered.`);
      setIsLoadingVideoUrl(true); // Ensure loading state is true when video starts loading
    }
  };

  return (
    <div 
      className={cn(
        "relative w-full h-full bg-muted overflow-hidden",
        className
      )}
      ref={containerRef}
      data-is-mobile={isMobile ? "true" : "false"}
      data-is-hovering={isHovering ? "true" : "false"}
      data-video-loaded={isVideoLoaded ? "true" : "false"}
      data-has-hovered={hasHovered ? "true" : "false"}
    >
      {/* Hover detection layer - NOW ALWAYS pointer-events-none */}
      <div
        className="absolute inset-0 z-50 pointer-events-none"
      />

      {/* Content wrapper - allows interaction with video */}
      <div className="relative w-full h-full">
        {/* Error Display */}
        {error && (
          <div className="absolute inset-0 z-30">
            <VideoPreviewError 
              error={error} 
              details={errorDetails || undefined}
              onRetry={handleRetry} 
              videoSource={videoUrl || videoLocation}
              canRecover={!previewMode}
            />
          </div>
        )}

        {/* Thumbnail Image */}
        {showThumbnail && (
           <img 
             src={thumbnailUrl} 
             alt={isVideoLoaded ? "Video thumbnail" : ""} 
             className={cn(
               "absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10 pointer-events-none",
               isVideoLoaded ? "opacity-0" : "opacity-100"
             )}
             loading="lazy"
             onLoad={() => logger.log(`${logPrefix} Thumbnail img loaded: ${thumbnailUrl?.substring(0,30)}...`)}
             onError={() => logger.error(`${logPrefix} Thumbnail img failed to load: ${thumbnailUrl?.substring(0,30)}...`)}
           />
         )}

        {/* Loading Spinner */}
        {showLoadingSpinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
          </div>
        )}

        {/* Video Player */}
        {showVideo && (
          <VideoPlayer
            key={`${componentId}-${videoUrl}`}
            src={videoUrl}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              isVideoLoaded ? "opacity-100" : "opacity-0"
            )}
            controls={controls && !previewMode}
            autoPlay={shouldPlay}
            playsInline
            triggerPlay={shouldBePlaying}
            muted={muted}
            loop={shouldBePlaying || (playOnHover && isHovering) || loop}
            playOnHover={playOnHover && !isMobile}
            onError={handleVideoError}
            showPlayButtonOnHover={showPlayButtonOnHover && !isMobile}
            containerRef={containerRef} 
            ref={videoRef}
            externallyControlled={isHoveringExternally !== undefined} 
            isHovering={isHovering} 
            poster={showThumbnail ? thumbnailUrl : undefined}
            showFirstFrameAsPoster={isMobile && !thumbnailUrl && !shouldBePlaying}
            lazyLoad={!forcePreload} // Only lazy load if not forced to preload
            preventLoadingFlicker={preventLoadingFlicker}
            onLoadedData={handleVideoLoadedData}
            onLoadStart={onVideoLoadStart} // Set loading state on video loadstart
            isMobile={isMobile}
            preload="auto"
            onVisibilityChange={onVisibilityChange}
            onEnterPreloadArea={handleEnterPreloadArea}
          />
        )}

         {/* Play Button Overlay */}
         {thumbnailUrl && !isHovering && showPlayButtonOnHover && !isMobile && !error && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/10">
             <div className="rounded-full bg-black/40 p-3 backdrop-blur-sm">
               <Play className="h-6 w-6 text-white" fill="white" />
             </div>
           </div>
         )}
      </div>
    </div>
  );
});

StorageVideoPlayer.displayName = 'StorageVideoPlayer';

export default StorageVideoPlayer;
