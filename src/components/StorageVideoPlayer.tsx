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
  onLoadedData?: () => void;
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
  logger.log(`[${componentId}] Rendering. Initial props: thumbnailUrl=${!!thumbnailUrl}, forcePreload=${forcePreload}, autoPlay=${autoPlay}`);

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoadingVideoUrl, setIsLoadingVideoUrl] = useState<boolean>(false); 
  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false); 
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(autoPlay || forcePreload); 
  const [hasHovered, setHasHovered] = useState(autoPlay || forcePreload);

  logger.log(`[${componentId}] Initial state: shouldLoadVideo=${shouldLoadVideo}, hasHovered=${hasHovered}`);

  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const isHoveringRef = useRef(isHoveringExternally || false);
  const unmountedRef = useRef(false);
  
  const isBlobUrl = videoLocation.startsWith('blob:');

  // Cleanup on unmount
  useEffect(() => {
    logger.log(`[${componentId}] Mounting effect ran.`);
    return () => {
      logger.log(`[${componentId}] Unmounting.`);
      unmountedRef.current = true;
    };
  }, []);

  // Sync external hover state
  useEffect(() => {
    isHoveringRef.current = isHoveringExternally || false;
    if (isHoveringExternally !== undefined && !unmountedRef.current) {
      logger.log(`StorageVideoPlayer: isHoveringExternally changed to ${isHoveringExternally}`);
      setIsHovering(isHoveringExternally);
      if (isHoveringExternally) {
        setHasHovered(true); 
        setShouldLoadVideo(true);
      }
    }
  }, [isHoveringExternally]);

  // Handle manual hover events
  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      logger.log('StorageVideoPlayer: Manual hover start');
      setIsHovering(true);
      setHasHovered(true);
      setShouldLoadVideo(true); 
    }
  };

  const handleManualHoverEnd = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      logger.log('StorageVideoPlayer: Manual hover end');
      setIsHovering(false);
    }
  };
  
  // Effect to fetch the video URL *only* when shouldLoadVideo is true
  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      logger.log(`[${componentId}] loadVideo called.`);
      if (unmountedRef.current || !videoLocation) return;

      logger.log(`[${componentId}] Attempting to load video URL for:`, videoLocation.substring(0, 50) + '...');
      setIsLoadingVideoUrl(true);
      setIsVideoLoaded(false); // Reset video loaded state when fetching new URL
      setError(null);
      
      try {
        let url;
        if (isBlobUrl) {
          url = videoLocation;
          logger.log('Using blob URL directly');
        } else {
          url = await videoUrlService.getVideoUrl(videoLocation, previewMode);
          logger.log('Fetched video URL:', url ? url.substring(0, 50) + '...' : 'null');
        }
        
        if (!url) {
          throw new Error('Could not resolve video URL');
        }
        
        if (isMounted && !unmountedRef.current) {
          setVideoUrl(url);
          logger.log(`[${componentId}] videoUrl state set:`, url ? url.substring(0, 50) + '...' : 'null');
          // Loading state (isLoadingVideoUrl) will be set to false in handleVideoLoadedData or finally block
        }
      } catch (error) {
        logger.error('Error loading video URL:', error);
        if (isMounted && !unmountedRef.current) {
          setError(`Failed to load video: ${error instanceof Error ? error.message : String(error)}`);
          setErrorDetails(String(error));
          setIsLoadingVideoUrl(false); 
        }
      } 
      // We don't set loading false in a finally here, because the video element itself needs to load
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
      logger.error('Video player reported error:', message);
      setError(message);
      setIsVideoLoaded(false); 
      setIsLoadingVideoUrl(false); // Stop loading state on error
    }
  };

  const handleRetry = () => {
    if (!unmountedRef.current) {
      logger.log('Retrying video load...');
      setIsLoadingVideoUrl(true); // Indicate loading state during retry
      setError(null);
      setErrorDetails(null);
      setVideoUrl(''); 
      setIsVideoLoaded(false);
      setShouldLoadVideo(true); 
      setRetryCount(prev => prev + 1);
    }
  };
  
  // Callback when the actual <video> element has loaded data
  const handleVideoLoadedData = () => {
    if (!unmountedRef.current) {
      logger.log(`[${componentId}] Video data loaded callback received from VideoPlayer.`);
      setIsVideoLoaded(true); 
      setIsLoadingVideoUrl(false); // URL and video data are loaded
      if (onLoadedData) {
        onLoadedData();
      }
    }
  };

  // Determine visibility states
  const showThumbnail = !!thumbnailUrl && (!hasHovered || isLoadingVideoUrl || !isVideoLoaded);
  const showVideo = hasHovered && !!videoUrl && !error;
  const showLoadingSpinner = !!thumbnailUrl && hasHovered && !isVideoLoaded && !error && (isLoadingVideoUrl || !videoUrl); 

  logger.log(`[${componentId}] Visibility states: showThumbnail=${showThumbnail}, showVideo=${showVideo}, showLoadingSpinner=${showLoadingSpinner}, isVideoLoaded=${isVideoLoaded}, hasHovered=${hasHovered}, videoUrl=${!!videoUrl}, error=${!!error}`);

  return (
    <div 
      className={cn("relative w-full h-full bg-muted overflow-hidden", className)}
      onMouseEnter={handleManualHoverStart}
      onMouseLeave={handleManualHoverEnd}
      ref={containerRef}
      data-is-mobile={isMobile ? "true" : "false"}
      data-is-hovering={isHovering ? "true" : "false"}
      data-video-loaded={isVideoLoaded ? "true" : "false"}
      data-has-hovered={hasHovered ? "true" : "false"}
    >
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
             // Hide thumbnail smoothly when video is loaded and ready to play (after hover)
             showVideo && isVideoLoaded ? "opacity-0" : "opacity-100" 
           )}
           loading="lazy" // Add lazy loading to thumbnails
           onLoad={() => logger.log(`[${componentId}] Thumbnail img loaded: ${thumbnailUrl.substring(0,30)}...`)}
           onError={() => logger.error(`[${componentId}] Thumbnail img failed to load: ${thumbnailUrl.substring(0,30)}...`)}
         />
       )}

      {/* Loading Spinner */}
      {showLoadingSpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
          <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
        </div>
      )}

      {/* Video Player - Rendered when hover starts, but opacity controls visibility */}
      {showVideo && (
        <VideoPlayer
          key={`${componentId}-${videoUrl}`}
          src={videoUrl}
          className={cn(
            "absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300",
            // Video fades in only when its data is loaded
            isVideoLoaded ? "opacity-100" : "opacity-0" 
          )}
          controls={controls && !previewMode} 
          autoPlay={isHovering && !isMobile}
          muted={muted}
          loop={loop}
          playOnHover={playOnHover && !isMobile}
          onError={handleVideoError}
          showPlayButtonOnHover={showPlayButtonOnHover && !isMobile}
          containerRef={containerRef} 
          videoRef={videoRef} 
          externallyControlled={isHoveringExternally !== undefined} 
          isHovering={isHovering} 
          poster={thumbnailUrl} // Pass thumbnail as poster
          onLoadedData={handleVideoLoadedData} 
          isMobile={isMobile}
        />
      )}

       {/* Play Button Overlay - Show over thumbnail when not hovering */}
       {thumbnailUrl && !isHovering && showPlayButtonOnHover && !isMobile && !error && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/10">
           <div className="rounded-full bg-black/40 p-3 backdrop-blur-sm">
             <Play className="h-6 w-6 text-white" fill="white" />
           </div>
         </div>
       )}
    </div>
  );
});

StorageVideoPlayer.displayName = 'StorageVideoPlayer';

export default StorageVideoPlayer;
