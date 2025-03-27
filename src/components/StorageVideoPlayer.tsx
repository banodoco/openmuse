
import React, { useState, useEffect } from 'react';
import VideoPlayer from './video/VideoPlayer';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';
import { supabase } from '@/integrations/supabase/client';
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
}

const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = ({
  videoLocation,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  playOnHover = false
}) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Load the video URL
  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!videoLocation) {
          throw new Error('No video location provided');
        }
        
        // Check if this is a blob URL that might be expired
        if (videoLocation.startsWith('blob:')) {
          try {
            const blobUrl = new URL(videoLocation);
            if (blobUrl.origin !== window.location.origin) {
              logger.warn('Blob URL from different origin detected, trying to resolve from database');
              const freshUrl = await videoUrlService.forceRefreshUrl(videoLocation);
              if (freshUrl) {
                logger.log(`Resolved fresh URL for blob: ${freshUrl.substring(0, 30)}...`);
                if (isMounted) setVideoUrl(freshUrl);
              } else {
                throw new Error('Failed to resolve video reference');
              }
              return;
            }
          } catch (e) {
            // If URL parsing fails, it's likely an invalid blob URL
            logger.warn('Invalid blob URL detected, trying to resolve from database');
            const freshUrl = await videoUrlService.forceRefreshUrl(videoLocation);
            if (freshUrl) {
              logger.log(`Resolved fresh URL: ${freshUrl.substring(0, 30)}...`);
              if (isMounted) setVideoUrl(freshUrl);
              setLoading(false);
              return;
            } else {
              throw new Error('Failed to resolve video reference');
            }
          }
        }
        
        // Use the video URL service for all other cases
        const url = await videoUrlService.getVideoUrl(videoLocation);
        
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
  }, [videoLocation, retryCount]);

  const handleError = (message: string) => {
    setError(message);
  };

  const handleRetry = () => {
    // Force a refresh by incrementing retry count
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setRetryCount(prev => prev + 1);
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
        />
      </div>
    );
  }

  return (
    <VideoPlayer
      src={videoUrl}
      className={className}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playOnHover={playOnHover}
      onError={handleError}
    />
  );
};

export default StorageVideoPlayer;
