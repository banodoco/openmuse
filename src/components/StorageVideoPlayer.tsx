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
  lazyLoad = true,
  videoRef: externalVideoRef,
  onLoadedData,
  thumbnailUrl,
  forcePreload = false,
  isMobile = false,
  preventLoadingFlicker = false
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
  const [shouldLoadVideo, setShouldLoadVideo] = useState(true);
  const [hoverInitiated, setHoverInitiated] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const isHoveringRef = useRef(isHoveringExternally || false);
  const unmountedRef = useRef(false);
  
  const isBlobUrl = videoLocation.startsWith('blob:');

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    isHoveringRef.current = isHoveringExternally || false;
    if (isHoveringExternally !== undefined && !unmountedRef.current) {
      logger.log(`StorageVideoPlayer: isHoveringExternally changed to ${isHoveringExternally}`);
      setIsHovering(isHoveringExternally);
      
      if (isHoveringExternally) {
        setHoverInitiated(true);
      }
    }
  }, [isHoveringExternally]);

  useEffect(() => {
    if (!unmountedRef.current) {
      setShouldLoadVideo(true);
    }
  }, [forcePreload]);

  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      logger.log('StorageVideoPlayer: Manual hover start');
      setIsHovering(true);
      setShouldLoadVideo(true);
      setHoverInitiated(true);
    }
  };

  const handleManualHoverEnd = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      logger.log('StorageVideoPlayer: Manual hover end');
      setIsHovering(false);
    }
  };
  
  useEffect(() => {
    if (isHoveringExternally !== undefined && !unmountedRef.current) {
      if (isHoveringExternally) {
        logger.log('External hover detected - loading video');
        setShouldLoadVideo(true);
      }
      
      if (videoInitialized && videoRef.current) {
        const video = videoRef.current;
        
        if (isHoveringExternally && video.paused && videoLoaded) {
          logger.log('External hover detected - attempting to play video');
          
          setTimeout(() => {
            if (video.paused && !unmountedRef.current) {
              video.play().catch(e => {
                if (e.name !== 'AbortError') {
                  logger.error('Error playing video on hover:', e);
                }
              });
            }
          }, 0);
        } else if (!isHoveringExternally && !video.paused) {
          logger.log('External hover ended - pausing video');
          video.pause();
          if (previewMode) {
            video.currentTime = 0;
          }
        }
      }
    }
  }, [isHoveringExternally, previewMode, videoRef, videoInitialized, videoLoaded]);
  
  useEffect(() => {
    let isMounted = true;
    
    // Preload the video URL immediately to have it ready for hover
    const loadVideo = async () => {
      try {
        if (!unmountedRef.current) {
          setLoading(true);
          setError(null);
        }
        
        if (!videoLocation) {
          throw new Error('No video location provided');
        }
        
        let url;
        if (isBlobUrl) {
          url = videoLocation;
          logger.log('Using blob URL directly:', url.substring(0, 30) + '...');
        } else {
          url = await videoUrlService.getVideoUrl(videoLocation, previewMode);
          logger.log('Fetched video URL:', url.substring(0, 30) + '...');
        }
        
        if (!url) {
          throw new Error('Could not resolve video URL');
        }
        
        if (isMounted && !unmountedRef.current) {
          setVideoUrl(url);
          setLoading(false);
          setVideoLoaded(true);
          setVideoInitialized(true);
          logger.log('Video URL loaded and ready');
        }
      } catch (error) {
        logger.error('Error loading video:', error);
        if (isMounted && !unmountedRef.current) {
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
    if (!unmountedRef.current) {
      setError(message);
    }
  };

  const handleRetry = () => {
    if (!unmountedRef.current) {
      setLoading(true);
      setError(null);
      setErrorDetails(null);
      setRetryCount(prev => prev + 1);
      setShouldLoadVideo(true);
    }
  };
  
  const handleVideoLoaded = () => {
    if (onLoadedData && !unmountedRef.current) {
      logger.log('StorageVideoPlayer: Video loaded, notifying parent');
      onLoadedData();
    }
  };

  React.useEffect(() => {
    if (thumbnailUrl && isMobile && !unmountedRef.current) {
      logger.log(`StorageVideoPlayer: Mobile with thumbnail - ${thumbnailUrl.substring(0, 30)}...`);
      setPosterUrl(thumbnailUrl);
    }
  }, [thumbnailUrl, isMobile]);

  return (
    <div 
      className="relative w-full h-full"
      onMouseEnter={handleManualHoverStart}
      onMouseLeave={handleManualHoverEnd}
      ref={containerRef}
      data-is-mobile={isMobile ? "true" : "false"}
    >
      {error && (
        <div className="relative h-full w-full bg-secondary/30 rounded-lg">
          <VideoPreviewError 
            error={error} 
            details={errorDetails || undefined}
            onRetry={handleRetry} 
            videoSource={videoUrl}
            canRecover={!previewMode}
          />
        </div>
      )}

      {!error && videoUrl && (
        <VideoPlayer
          src={videoUrl}
          className={className}
          controls={controls}
          autoPlay={autoPlay || isHovering}
          muted={muted}
          loop={loop}
          playOnHover={playOnHover}
          onError={handleError}
          showPlayButtonOnHover={showPlayButtonOnHover}
          containerRef={containerRef}
          videoRef={videoRef}
          externallyControlled={isHoveringExternally !== undefined}
          isHovering={isHovering}
          poster={posterUrl || undefined}
          lazyLoad={false}
          onLoadedData={handleVideoLoaded}
          isMobile={isMobile}
          preventLoadingFlicker={true}
        />
      )}

      {!videoUrl && posterUrl && !error && isMobile && (
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
      )}

      {!videoUrl && posterUrl && !error && !isMobile && (
        <img 
          src={posterUrl} 
          alt="Video thumbnail" 
          className="w-full h-full object-cover absolute inset-0 z-0 pointer-events-none"
        />
      )}
    </div>
  );
});

StorageVideoPlayer.displayName = 'StorageVideoPlayer';

export default StorageVideoPlayer;
