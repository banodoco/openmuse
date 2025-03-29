
import React, { useState, useEffect, useRef, memo } from 'react';
import VideoPlayer from './video/VideoPlayer';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';
import { videoUrlService } from '@/lib/services/videoUrlService';

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
  thumbnailOnly?: boolean; // New prop to only show the thumbnail
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
  thumbnailOnly = false // Default to false for backwards compatibility
}) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [videoInitialized, setVideoInitialized] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(!thumbnailOnly); // Only load video if not thumbnailOnly
  
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  
  const isBlobUrl = videoLocation.startsWith('blob:');
  
  // Handle external hover state changes without causing re-renders
  useEffect(() => {
    if (isHoveringExternally !== undefined) {
      setIsHovering(isHoveringExternally);
      
      if (videoInitialized && shouldLoadVideo) {
        const video = videoRef.current;
        if (video) {
          if (isHoveringExternally && video.paused) {
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
    }
  }, [isHoveringExternally, previewMode, videoRef, videoInitialized, shouldLoadVideo]);
  
  // Generate poster image for lazy loading
  useEffect(() => {
    const generatePoster = async () => {
      try {
        if ((lazyLoad || thumbnailOnly) && !posterUrl && videoUrl) {
          if (thumbnailOnly) {
            // For thumbnail-only mode, try to get poster URL directly from the URL pattern
            // This is more efficient than loading a video
            const urlObj = new URL(videoUrl);
            const fileExtension = videoUrl.split('.').pop()?.toLowerCase();
            
            if (fileExtension && ['mp4', 'webm', 'mov'].includes(fileExtension)) {
              // Try to generate a thumbnail URL based on common patterns
              // For Supabase storage, we can try to get the thumbnail this way
              const pathParts = urlObj.pathname.split('/');
              const filename = pathParts[pathParts.length - 1];
              const filenameParts = filename.split('.');
              
              // If we're dealing with Supabase storage, we could potentially
              // request a thumbnail from a separate bucket or path if one exists
              if (urlObj.hostname.includes('supabase')) {
                logger.log('Setting generic poster for Supabase video');
                // Use first-frame extraction only when needed
                await extractFirstFrame(videoUrl);
                return;
              }
            }
            
            // If we can't determine a pattern, fall back to frame extraction
            await extractFirstFrame(videoUrl);
          } else {
            // Standard method - extract first frame
            await extractFirstFrame(videoUrl);
          }
        }
      } catch (e) {
        logger.error('Error in poster generation:', e);
      }
    };
    
    const extractFirstFrame = async (videoUrl: string) => {
      // Create a hidden video element to extract the first frame
      const tempVideo = document.createElement('video');
      tempVideo.crossOrigin = "anonymous";
      tempVideo.muted = true;
      tempVideo.preload = 'metadata';
      tempVideo.src = videoUrl;
      
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
    };
    
    generatePoster();
  }, [videoUrl, lazyLoad, posterUrl, thumbnailOnly]);
  
  // Load video URL only once when component mounts or videoLocation changes
  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
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
    
    if (videoLocation) {
      loadVideo();
    }
    
    return () => {
      isMounted = false;
    };
  }, [videoLocation, retryCount, previewMode, isBlobUrl]);

  const handleError = (message: string) => {
    setError(message);
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setRetryCount(prev => prev + 1);
  };
  
  const handleVideoLoaded = () => {
    if (onLoadedData) {
      logger.log('StorageVideoPlayer: Video loaded, notifying parent');
      onLoadedData();
    }
  };
  
  const handleContainerClick = () => {
    if (thumbnailOnly) {
      // On click, load and play the actual video
      setShouldLoadVideo(true);
    }
  };

  if (loading && !thumbnailOnly) {
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
  
  // If we're in thumbnailOnly mode and have a poster but don't want to load the video yet
  if (thumbnailOnly && posterUrl && !shouldLoadVideo) {
    return (
      <div 
        className={`relative w-full h-full ${className || ''}`}
        onClick={handleContainerClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="absolute inset-0 bg-cover bg-center rounded-lg" style={{ backgroundImage: `url(${posterUrl})` }} />
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-white/10 rounded-full p-2 backdrop-blur-sm">
            <Play className="h-8 w-8 text-white/70" />
          </div>
        </div>
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
    prevProps.thumbnailOnly === nextProps.thumbnailOnly
  );
});

export default StorageVideoPlayer;
