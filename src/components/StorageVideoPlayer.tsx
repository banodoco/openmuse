import React, { useState, useEffect, useRef, memo } from 'react';
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
}) => {
  const componentId = useRef(`storage_video_${Math.random().toString(36).substring(2, 9)}`).current;
  const logPrefix = `[SVP_DEBUG][${componentId}]`;
  logger.log(`${logPrefix} Rendering. Initial props: thumbnailUrl=${!!thumbnailUrl}, forcePreload=${forcePreload}, autoPlay=${autoPlay}`);

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoadingVideoUrl, setIsLoadingVideoUrl] = useState<boolean>(false); 
  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false); 
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(true);
  const [hasHovered, setHasHovered] = useState(forcePreload || (!isMobile && autoPlay));
  const [shouldPlay, setShouldPlay] = useState(isMobile ? false : (forcePreload || autoPlay));
  const prevVideoLocationRef = useRef<string | null>(null);

  logger.log(`${logPrefix} Initial state: shouldLoadVideo=${shouldLoadVideo}, hasHovered=${hasHovered}`);

  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const isHoveringRef = useRef(isHoveringExternally || false);
  const unmountedRef = useRef(false);
  
  const isBlobUrl = videoLocation.startsWith('blob:');

  // Cleanup on unmount
  useEffect(() => {
    logger.log(`${logPrefix} Mounting effect ran.`);
    return () => {
      logger.log(`${logPrefix} Unmounting.`);
      unmountedRef.current = true;
    };
  }, []);

  // Sync external hover state
  useEffect(() => {
    isHoveringRef.current = isHoveringExternally || false;
    if (isHoveringExternally !== undefined && !unmountedRef.current) {
      logger.log(`${logPrefix} isHoveringExternally changed to ${isHoveringExternally}`);
      setIsHovering(isHoveringExternally);
      if (isHoveringExternally) {
        setHasHovered(true); 
        setShouldLoadVideo(true);
        // Update shouldPlay when hovering starts
        if (!isMobile) {
          setShouldPlay(true);
        }
      } else {
        // Stop playing when hover ends
        setShouldPlay(false);
      }
    }
  }, [isHoveringExternally, isMobile]);

  // Effect to handle mobile state – only auto–load if `forcePreload` is set.
  useEffect(() => {
    if (isMobile && forcePreload && !unmountedRef.current) {
      logger.log(`${logPrefix} Mobile + forcePreload: Setting shouldLoadVideo=true, hasHovered=true`);
      setShouldLoadVideo(true);
      setHasHovered(true);
    }
  }, [isMobile, forcePreload]);

  // Handle manual hover events
  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      logger.log(`${logPrefix} Manual hover start`);
      setIsHovering(true);
      setHasHovered(true);
      setShouldLoadVideo(true);
      if (!isMobile) {
        setShouldPlay(true);
      }
    }
  };

  const handleManualHoverEnd = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      logger.log(`${logPrefix} Manual hover end`);
      setIsHovering(false);
      setShouldPlay(false);
    }
  };
  
  // Effect to fetch the video URL *only* when shouldLoadVideo is true
  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      logger.log(`${logPrefix} loadVideo called.`);
      if (unmountedRef.current || !videoLocation) {
        logger.log(`${logPrefix} loadVideo aborted: unmounted or no videoLocation.`);
        return;
      }

      const isNewVideo = prevVideoLocationRef.current !== videoLocation;
      prevVideoLocationRef.current = videoLocation;

      if (isNewVideo) {
        logger.log(`${logPrefix} Video location changed. Resetting states and loading new video.`);
        setIsLoadingVideoUrl(true);
        setIsVideoLoaded(false);
        setError(null);
      } else if (videoUrl) {
        logger.log(`${logPrefix} Video location unchanged and URL exists. Skipping load.`);
        return;
      }

      logger.log(`${logPrefix} Attempting to load video URL for:`, videoLocation.substring(0, 50) + '...');
      
      try {
        let url;
        logger.log(`${logPrefix} Calling videoUrlService.getVideoUrl with location:`, videoLocation);
        if (isBlobUrl) {
          url = videoLocation;
          logger.log(`${logPrefix} Using blob URL directly:`, url.substring(0, 50) + '...');
        } else {
          url = await videoUrlService.getVideoUrl(videoLocation, previewMode);
          logger.log(`${logPrefix} Fetched video URL from service:`, url ? url.substring(0, 50) + '...' : 'null or undefined');
        }
        
        if (!url) {
          logger.error(`${logPrefix} videoUrlService returned null or undefined for location:`, videoLocation);
          throw new Error('Could not resolve video URL');
        }
        
        if (isMounted && !unmountedRef.current) {
          setVideoUrl(url);
          logger.log(`${logPrefix} videoUrl state successfully set.`);
          // Loading state (isLoadingVideoUrl) will be set to false in handleVideoLoadedData
        }
      } catch (error) {
        logger.error(`${logPrefix} Error in loadVideo for location ${videoLocation}:`, error);
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

  const handleVideoError = (message: string) => {
    if (!unmountedRef.current) {
      logger.error(`${logPrefix} Video player reported error:`, message);
      setError(message);
      setIsVideoLoaded(false); 
      setIsLoadingVideoUrl(false); // Stop loading state on error
    }
  };

  const handleRetry = () => {
    if (!unmountedRef.current) {
      logger.log(`${logPrefix} Retrying video load...`);
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
      logger.log(`${logPrefix} Video loaded data`);
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
      logger.log(`${logPrefix} Mobile tap to load video`);
      setShouldPlay(true);
      setHasHovered(true);
    }
  };

  // Determine visibility states
  const showThumbnail = !!thumbnailUrl && ((!hasHovered && !isMobile) || isLoadingVideoUrl || !isVideoLoaded);
  const showVideo = !!videoUrl && !error;
  const showLoadingSpinner = !!thumbnailUrl && ((hasHovered || isMobile) && !isVideoLoaded && !error && isLoadingVideoUrl);

  logger.log(`${logPrefix} Visibility states: showThumbnail=${showThumbnail}, showVideo=${showVideo}, showLoadingSpinner=${showLoadingSpinner}, isVideoLoaded=${isVideoLoaded}, hasHovered=${hasHovered}, videoUrl=${!!videoUrl}, error=${!!error}`);

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
      style={{ pointerEvents: 'none' }}
    >
      {/* Hover detection layer - only handles hover events */}
      <div
        className="absolute inset-0 z-50"
        onMouseEnter={handleManualHoverStart}
        onMouseLeave={handleManualHoverEnd}
        style={{ 
          pointerEvents: previewMode ? 'auto' : 'none',
          cursor: 'pointer'
        }}
      />

      {/* Content wrapper - allows clicks to pass through to parent */}
      <div className="relative w-full h-full" style={{ pointerEvents: 'none' }}>
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
        {thumbnailUrl && (
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
              isVideoLoaded ? "opacity-100" : "opacity-0",
              "pointer-events-none"
            )}
            controls={controls && !previewMode} 
            autoPlay={false}
            triggerPlay={shouldPlay}
            muted={muted}
            loop={(playOnHover && isHovering) || loop}
            playOnHover={playOnHover && !isMobile}
            onError={handleVideoError}
            showPlayButtonOnHover={showPlayButtonOnHover && !isMobile}
            containerRef={containerRef} 
            videoRef={videoRef} 
            externallyControlled={isHoveringExternally !== undefined} 
            isHovering={isHovering} 
            poster={thumbnailUrl}
            onLoadedData={handleVideoLoadedData} 
            isMobile={isMobile}
            preload="auto"
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
