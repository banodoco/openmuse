import React, { useState, useEffect, useRef, memo } from 'react';
import VideoPlayer from './video/VideoPlayer';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Play } from 'lucide-react';

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
  lazyLoad?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onLoadedData?: () => void;
  thumbnailUrl?: string;
  forcePreload?: boolean;
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
  lazyLoad = true,
  videoRef: externalVideoRef,
  onLoadedData,
  thumbnailUrl,
  forcePreload = false
}) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const [posterUrl, setPosterUrl] = useState<string | null>(thumbnailUrl || null);
  const [videoInitialized, setVideoInitialized] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(autoPlay || !lazyLoad || forcePreload);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const hoverTimerRef = useRef<number | null>(null);
  const hoverStateChangedRef = useRef(false);
  
  const isBlobUrl = videoLocation.startsWith('blob:');

  // Update shouldLoadVideo when forcePreload changes
  useEffect(() => {
    if (forcePreload && !shouldLoadVideo) {
      logger.log('Force preloading video due to hover');
      setShouldLoadVideo(true);
    }
  }, [forcePreload, shouldLoadVideo]);

  // Detect manual hover changes
  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined) {
      setIsHovering(true);
      hoverStateChangedRef.current = true;
      setShouldLoadVideo(true);
    }
  };

  const handleManualHoverEnd = () => {
    if (isHoveringExternally === undefined) {
      setIsHovering(false);
      hoverStateChangedRef.current = true;
    }
  };
  
  // Handle external hover state changes
  useEffect(() => {
    if (isHoveringExternally !== undefined) {
      setIsHovering(isHoveringExternally);
      hoverStateChangedRef.current = true;
      
      // Start loading video immediately when hovering starts
      if (isHoveringExternally && !shouldLoadVideo) {
        logger.log('External hover detected - loading video');
        setShouldLoadVideo(true);
      }
      
      if (videoInitialized) {
        const video = videoRef.current;
        if (video) {
          if (isHoveringExternally && video.paused && videoLoaded) {
            logger.log('External hover detected - attempting to play video');
            // Smaller delay for a more responsive feel
            const playTimer = setTimeout(() => {
              if (video && !video.paused) return; // Don't play if already playing
              
              video.play().catch(e => {
                if (e.name !== 'AbortError') {
                  logger.error('Error playing video on hover:', e);
                }
              });
            }, 30);
            
            return () => clearTimeout(playTimer);
          } else if (!isHoveringExternally && !video.paused) {
            logger.log('External hover ended - pausing video');
            video.pause();
            if (previewMode) {
              video.currentTime = 0;
            }
          }
        }
      }
    }
    
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [isHoveringExternally, previewMode, videoRef, videoInitialized, videoLoaded, shouldLoadVideo]);
  
  // Generate poster image for lazy loading if not provided
  useEffect(() => {
    if (thumbnailUrl) {
      setPosterUrl(thumbnailUrl);
      return;
    }
    
    const generatePoster = async () => {
      try {
        if (lazyLoad && !posterUrl && videoUrl) {
          // Create a hidden video element to extract the first frame
          const tempVideo = document.createElement('video');
          tempVideo.crossOrigin = "anonymous";
          tempVideo.src = videoUrl;
          tempVideo.muted = true;
          tempVideo.preload = 'metadata';
          
          tempVideo.onloadedmetadata = () => {
            tempVideo.currentTime = 0.1;
          };
          
          tempVideo.onseeked = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = tempVideo.videoWidth || 640;
              canvas.height = tempVideo.videoHeight || 360;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setPosterUrl(dataUrl);
                
                // Clean up
                tempVideo.pause();
                tempVideo.src = '';
                tempVideo.load();
              }
            } catch (e) {
              logger.error('Error generating poster:', e);
            }
          };
          
          tempVideo.load();
        }
      } catch (e) {
        logger.error('Error in poster generation:', e);
      }
    };
    
    generatePoster();
  }, [videoUrl, lazyLoad, posterUrl, thumbnailUrl]);
  
  // Load video URL only when needed (on hover or if not lazy loading)
  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      if (!shouldLoadVideo) return;
      
      try {
        setLoading(true);
        setError(null);
        
        if (!videoLocation) {
          throw new Error('No video location provided');
        }
        
        let url;
        if (previewMode) {
          if (isBlobUrl) {
            url = videoLocation;
            logger.log('Using blob URL directly in preview mode:', url.substring(0, 30) + '...');
          } else {
            url = await videoUrlService.getVideoUrl(videoLocation, true);
          }
        } else {
          url = await videoUrlService.getVideoUrl(videoLocation, false);
        }
        
        if (!url) {
          throw new Error('Could not resolve video URL');
        }
        
        if (isMounted) {
          setVideoUrl(url);
          setLoading(false);
          setVideoLoaded(true);
          // Mark video as initialized after URL is set
          setVideoInitialized(true);
        }
      } catch (error) {
        logger.error('Error loading video:', error);
        if (isMounted) {
          setError(`Failed to load video: ${error instanceof Error ? error.message : String(error)}`);
          setErrorDetails(String(error));
          setLoading(false);
        }
      }
    };
    
    if (videoLocation && shouldLoadVideo) {
      loadVideo();
    } else if (!shouldLoadVideo && posterUrl) {
      setLoading(false); // Don't show loading state if we have a poster
    }
    
    return () => {
      isMounted = false;
    };
  }, [videoLocation, retryCount, previewMode, isBlobUrl, shouldLoadVideo, posterUrl]);

  const handleError = (message: string) => {
    setError(message);
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setRetryCount(prev => prev + 1);
    setShouldLoadVideo(true);
  };
  
  const handleVideoLoaded = () => {
    if (onLoadedData) {
      logger.log('StorageVideoPlayer: Video loaded, notifying parent');
      onLoadedData();
    }
  };

  const handleLoadVideo = () => {
    if (!videoLoaded) {
      setShouldLoadVideo(true);
    }
  };
  
  // If we have a poster but haven't started loading the video
  if (!shouldLoadVideo && posterUrl) {
    return (
      <div 
        className={`relative h-full w-full ${className || ''}`}
        onClick={handleLoadVideo}
        onMouseEnter={handleManualHoverStart}
        onMouseLeave={handleManualHoverEnd}
      >
        <img 
          src={posterUrl} 
          alt="Video thumbnail" 
          className="w-full h-full object-cover pointer-events-none"
        />
        
        {showPlayButtonOnHover && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-black/40 p-3">
              <Play className="h-6 w-6 text-white" />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading && !posterUrl) {
    return <div className="flex items-center justify-center h-full bg-secondary/30 rounded-lg">Loading video...</div>;
  }

  if (error) {
    return (
      <div className="relative h-full w-full bg-secondary/30 rounded-lg">
        <VideoPreviewError 
          error={error} 
          details={errorDetails || undefined}
          onRetry={handleRetry} 
          videoSource={videoUrl}
          canRecover={!previewMode}
        />
      </div>
    );
  }

  // Main video player render
  return (
    <div 
      className="relative w-full h-full"
      onMouseEnter={handleManualHoverStart}
      onMouseLeave={handleManualHoverEnd}
    >
      {/* Show loading overlay if video is loading but we have a poster */}
      {loading && posterUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
          <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
          <img 
            src={posterUrl} 
            alt="Video thumbnail" 
            className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
          />
        </div>
      )}

      <VideoPlayer
        src={videoUrl}
        className={className}
        controls={controls}
        autoPlay={autoPlay || isHovering}
        muted={muted}
        loop={loop}
        playOnHover={playOnHover && isHoveringExternally === undefined}
        onError={handleError}
        showPlayButtonOnHover={showPlayButtonOnHover}
        containerRef={containerRef}
        videoRef={videoRef}
        externallyControlled={true}
        isHovering={isHovering}
        poster={posterUrl || undefined}
        lazyLoad={lazyLoad}
        onLoadedData={handleVideoLoaded}
      />
    </div>
  );
});

StorageVideoPlayer.displayName = 'StorageVideoPlayer';

export default StorageVideoPlayer;
