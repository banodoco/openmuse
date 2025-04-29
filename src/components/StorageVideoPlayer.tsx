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

  // logger.log(`${logPrefix} Initial state: shouldLoadVideo=${shouldLoadVideo}, hasHovered=${hasHovered}, shouldPlay=${shouldPlay}`);

  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const isHoveringRef = useRef(isHoveringExternally || false); // Ref to track hover state
  const unmountedRef = useRef(false);
  
  const isBlobUrl = videoLocation.startsWith('blob:');

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
    isHoveringRef.current = isHoveringExternally || false;
    if (isHoveringExternally !== undefined && !unmountedRef.current) {
      // logger.log(`${logPrefix} isHoveringExternally changed to ${isHoveringExternally}`);
      setIsHovering(isHoveringExternally); // Update internal hover state for consistency
      if (isHoveringExternally) {
        // Trigger loading on hover start if not already loading/loaded
        if (!shouldLoadVideo && !videoUrl && !error) {
           // logger.log(`${logPrefix} Triggering load on external hover start`);
           setShouldLoadVideo(true);
           setHasHovered(true); // Mark as interacted
        }
      }
      // NOTE: Play decision is handled in the dedicated effect below
    }
  }, [isHoveringExternally, shouldLoadVideo, videoUrl, error]);

  // Effect to determine if the video should be playing based on props and state
  useEffect(() => {
    if (unmountedRef.current) return;

    // If we're on mobile and autoPlay is enabled, force playback immediately
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
    if (isMobile && forcePreload && !unmountedRef.current) {
      // logger.log(`${logPrefix} Mobile + forcePreload: Setting shouldLoadVideo=true, hasHovered=true`);
      setShouldLoadVideo(true);
      setHasHovered(true);
    }
  }, [isMobile, forcePreload]);

  // Handle manual hover events (only trigger load, play logic handled above)
  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
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
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      // logger.log(`${logPrefix} Manual hover end`);
      setIsHovering(false);
      // Play state will be updated by the dedicated effect based on isHovering=false
    }
  };
  
  // Effect to fetch the video URL *only* when shouldLoadVideo is true
  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      // logger.log(`${logPrefix} loadVideo called.`);
      if (unmountedRef.current || !videoLocation) {
        // logger.log(`${logPrefix} loadVideo aborted: unmounted or no videoLocation.`);
        return;
      }

      const isNewVideo = prevVideoLocationRef.current !== videoLocation;
      prevVideoLocationRef.current = videoLocation;

      if (isNewVideo) {
        // logger.log(`${logPrefix} Video location changed. Resetting states and loading new video.`);
        setIsLoadingVideoUrl(true);
        setIsVideoLoaded(false);
        setError(null);
      } else if (videoUrl) {
        // logger.log(`${logPrefix} Video location unchanged and URL exists. Skipping load.`);
        return;
      }

      // logger.log(`${logPrefix} Attempting to load video URL for:`, videoLocation.substring(0, 50) + '...');
      
      try {
        let url;
        // logger.log(`${logPrefix} Calling videoUrlService.getVideoUrl with location:`, videoLocation);
        if (isBlobUrl) {
          url = videoLocation;
          // logger.log(`${logPrefix} Using blob URL directly:`, url.substring(0, 50) + '...');
        } else {
          url = await videoUrlService.getVideoUrl(videoLocation, previewMode);
          // logger.log(`${logPrefix} Fetched video URL from service:`, url ? url.substring(0, 50) + '...' : 'null or undefined');
        }
        
        if (!url) {
          // logger.error(`${logPrefix} videoUrlService returned null or undefined for location:`, videoLocation);
          throw new Error('Could not resolve video URL');
        }
        
        if (isMounted && !unmountedRef.current) {
          setVideoUrl(url);
          // logger.log(`${logPrefix} videoUrl state successfully set.`);
          // Loading state (isLoadingVideoUrl) will be set to false in handleVideoLoadedData
        }
      } catch (error) {
        // logger.error(`${logPrefix} Error in loadVideo for location ${videoLocation}:`, error);
        if (isMounted && !unmountedRef.current) {
          setError(`Failed to load video: ${error instanceof Error ? error.message : String(error)}`);
          setErrorDetails(String(error));
          setIsLoadingVideoUrl(false); 
        }
      }
    };
    
    if (shouldLoadVideo && !videoUrl && videoLocation && !error) {
      loadVideo();
    } else if (videoUrl) {
      // If we already have the URL (e.g., from preload), ensure loading state is false
      setIsLoadingVideoUrl(false);
    }
    
    return () => {
      isMounted = false;
    };
  }, [videoLocation, retryCount, previewMode, isBlobUrl, shouldLoadVideo, videoUrl, error]);

  // Callback from VideoPlayer when entering/leaving the preload area
  const handleEnterPreloadArea = useCallback((isInPreloadArea: boolean) => {
    if (isInPreloadArea && !preloadTriggered && !unmountedRef.current) {
      logger.log(`${logPrefix} Entered preload area. Triggering video load.`);
      setPreloadTriggered(true);
      // Ensure video loading starts
      if (!videoUrl && videoLocation && !error) {
         const loadVideo = async () => {
            if (unmountedRef.current || !videoLocation) return;
            setIsLoadingVideoUrl(true);
            setError(null);
            try {
                const url = isBlobUrl ? videoLocation : await videoUrlService.getVideoUrl(videoLocation, previewMode);
                if (!url) throw new Error('Could not resolve video URL');
                if (!unmountedRef.current) setVideoUrl(url);
            } catch (err) {
                if (!unmountedRef.current) {
                    setError(`Failed to load video: ${err instanceof Error ? err.message : String(err)}`);
                    setIsLoadingVideoUrl(false); 
                }
            }
         };
         loadVideo();
      } // else: video is already loading or loaded, or has errored.
    }
    // We might want logic here if isInPreloadArea becomes false, e.g., cancel loading?
    // For now, just trigger load on first entry.
  }, [preloadTriggered, videoUrl, videoLocation, isBlobUrl, previewMode, error]);

  const handleVideoError = (message: string) => {
    if (!unmountedRef.current) {
      // logger.error(`${logPrefix} Video player reported error:`, message);
      setError(message);
      setIsVideoLoaded(false); 
      setIsLoadingVideoUrl(false); // Stop loading state on error
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
      {/* Hover detection layer - conditionally disable pointer events */}
      <div
        className={cn(
          "absolute inset-0 z-50",
          // Disable pointer events on the overlay ONLY when controls are enabled AND interaction is specifically allowed
          allowControlInteraction && controls && "pointer-events-none"
        )}
        // Only attach hover handlers if interaction isn't allowed (or controls are off)
        onMouseEnter={!(allowControlInteraction && controls) ? handleManualHoverStart : undefined}
        onMouseLeave={!(allowControlInteraction && controls) ? handleManualHoverEnd : undefined}
        // Don't set cursor style if pointer events are none
        style={!(allowControlInteraction && controls) ? { cursor: 'pointer' } : {}}
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
             alt="Video thumbnail" 
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
            videoRef={videoRef} 
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
