
import React, { useEffect, useState } from 'react';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import VideoPlayer from './video/VideoPlayer';
import { convertBlobToDataUrl, createDataUrlFromImage } from '@/lib/utils/videoUtils';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';

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

  const loadVideo = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      setErrorDetails(null);
      
      logger.log(`Loading video from location: ${videoLocation}`);
      
      // Get database instance
      const db = await databaseSwitcher.getDatabase();
      
      // Get the actual URL for the video
      let url = await db.getVideoUrl(videoLocation);
      
      if (!url) {
        setError('Video could not be loaded');
        setLoading(false);
        return;
      }
      
      // If this is a blob URL, convert it to a data URL to avoid cross-origin issues
      if (url.startsWith('blob:')) {
        logger.log(`Got blob URL: ${url.substring(0, 30)}..., attempting conversion`);
        try {
          const dataUrl = await convertBlobToDataUrl(url);
          if (dataUrl !== url) {
            logger.log('Successfully converted blob URL to data URL');
            url = dataUrl;
          } else {
            // Try alternative image-based conversion method
            logger.log('Standard conversion failed, trying image-based conversion');
            const imageDataUrl = await createDataUrlFromImage(url);
            if (imageDataUrl !== url) {
              logger.log('Successfully converted blob URL to image data URL');
              url = imageDataUrl;
            }
          }
        } catch (conversionError) {
          logger.error('Failed to convert blob URL:', conversionError);
          // Continue with original URL but log the error
          setErrorDetails(`Conversion error: ${conversionError}`);
        }
      }
      
      setVideoUrl(url);
      setLoading(false);
    } catch (error) {
      logger.error('Error loading video:', error);
      setError('An error occurred while loading the video');
      setErrorDetails(`${error}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    if (videoLocation) {
      loadVideo();
    }
    
    return () => {
      isMounted = false;
      // Clean up object URL if it was created
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoLocation]);

  const handleError = (message: string) => {
    setError(message);
  };

  const handleRetry = () => {
    loadVideo(true);
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
