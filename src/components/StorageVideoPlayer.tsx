
import React, { useState, useEffect, useRef } from 'react';
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
}

const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = ({
  videoLocation,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  playOnHover = false,
  previewMode = false,
  showPlayButtonOnHover = true,
  isHoveringExternally
}) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const isBlobUrl = videoLocation.startsWith('blob:');
  
  useEffect(() => {
    if (isHoveringExternally !== undefined) {
      const prevHovering = isHovering;
      setIsHovering(isHoveringExternally);
      
      if (!prevHovering && isHoveringExternally) {
        logger.log('StorageVideoPlayer: External hover state changed to true');
      } else if (prevHovering && !isHoveringExternally) {
        logger.log('StorageVideoPlayer: External hover state changed to false');
      }
      
      const video = videoRef.current;
      if (video) {
        if (isHoveringExternally && video.paused) {
          logger.log('StorageVideoPlayer: External hover detected - attempting to play video');
          video.play().catch(e => logger.error('Error playing video on hover:', e));
        } else if (!isHoveringExternally && !video.paused) {
          logger.log('StorageVideoPlayer: External hover ended - pausing video');
          video.pause();
        }
      }
    }
  }, [isHoveringExternally, isHovering]);

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

  const handleMouseEnter = () => {
    if (isHoveringExternally === undefined) {
      logger.log('StorageVideoPlayer: Mouse entered - setting isHovering to true');
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    if (isHoveringExternally === undefined) {
      logger.log('StorageVideoPlayer: Mouse left - setting isHovering to false');
      setIsHovering(false);
    }
  };

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
    <div 
      ref={containerRef}
      className="w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
      />
    </div>
  );
};

export default StorageVideoPlayer;
