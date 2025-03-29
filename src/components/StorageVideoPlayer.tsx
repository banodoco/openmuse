
import React, { useState, useEffect, useRef, memo } from 'react';
import VideoPlayer from './video/VideoPlayer';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Play } from 'lucide-react'; // Import the Play icon

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
  thumbnailUrl?: string; // Add support for passing in a saved thumbnail
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
  thumbnailUrl
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
  const [shouldLoadVideo, setShouldLoadVideo] = useState(autoPlay || !lazyLoad);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const hoverTimerRef = useRef<number | null>(null);
  
  const isBlobUrl = videoLocation.startsWith('blob:');
  
  // Handle external hover state changes
  useEffect(() => {
    if (isHoveringExternally !== undefined) {
      setIsHovering(isHoveringExternally);
      
      // Start loading video after a short delay when hovering starts
      if (isHoveringExternally && !videoLoaded) {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = window.setTimeout(() => {
          setShouldLoadVideo(true);
        }, 300); // Short delay before loading video
      }
      
      if (videoInitialized) {
        const video = videoRef.current;
        if (video) {
          if (isHoveringExternally && video.paused && videoLoaded) {
            logger.log('External hover detected - attempting to play video');
            // Add a small delay before playing to avoid interruptions
            const playTimer = setTimeout(() => {
              if (video && !video.paused) return; // Don't play if already playing
              
              video.play().catch(e => {
                if (e.name !== 'AbortError') {
                  logger.error('Error playing video on hover:', e);
                }
              });
            }, 50);
            
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
      
      // Clear the timer when hovering stops
      if (!isHoveringExternally && hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    }
    
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [isHoveringExternally, previewMode, videoRef, videoInitialized, videoLoaded]);
  
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
        onMouseEnter={() => {
          if (playOnHover && isHoveringExternally === undefined) {
            setIsHovering(true);
            handleLoadVideo();
          }
        }}
        onMouseLeave={() => {
          if (playOnHover && isHoveringExternally === undefined) {
            setIsHovering(false);
          }
        }}
      >
        <img 
          src={posterUrl} 
          alt="Video thumbnail" 
          className="w-full h-full object-cover"
        />
        
        {showPlayButtonOnHover && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/40 p-3">
              <Play className="h-6 w-6 text-white" />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
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

  return (
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
      externallyControlled={isHoveringExternally !== undefined}
      isHovering={isHovering}
      poster={posterUrl || undefined}
      lazyLoad={lazyLoad}
      onLoadedData={handleVideoLoaded}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.videoLocation === nextProps.videoLocation &&
    prevProps.isHoveringExternally === nextProps.isHoveringExternally &&
    prevProps.className === nextProps.className &&
    prevProps.controls === nextProps.controls &&
    prevProps.autoPlay === nextProps.autoPlay &&
    prevProps.muted === nextProps.muted &&
    prevProps.loop === nextProps.loop &&
    prevProps.lazyLoad === nextProps.lazyLoad &&
    prevProps.thumbnailUrl === nextProps.thumbnailUrl
  );
});

export default StorageVideoPlayer;
