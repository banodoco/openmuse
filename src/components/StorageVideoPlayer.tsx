
import React, { useEffect, useState } from 'react';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import VideoPlayer from './video/VideoPlayer';
import { convertBlobToDataUrl } from '@/lib/utils/videoUtils';
import { Logger } from '@/lib/logger';

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

  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        logger.log(`Loading video from location: ${videoLocation}`);
        
        // Get database instance
        const db = await databaseSwitcher.getDatabase();
        
        // Get the actual URL for the video
        let url = await db.getVideoUrl(videoLocation);
        
        // If this is a blob URL, try to convert it to a data URL to avoid cross-origin issues
        if (url && url.startsWith('blob:')) {
          logger.log(`Got blob URL: ${url.substring(0, 30)}..., attempting conversion`);
          try {
            const dataUrl = await convertBlobToDataUrl(url);
            if (dataUrl !== url) {
              logger.log('Successfully converted blob URL to data URL');
              url = dataUrl;
            }
          } catch (conversionError) {
            logger.error('Failed to convert blob URL to data URL:', conversionError);
            // Continue with original URL
          }
        }
        
        if (isMounted) {
          if (url) {
            setVideoUrl(url);
          } else {
            setError('Video could not be loaded');
          }
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          logger.error('Error loading video:', error);
          setError('An error occurred while loading the video');
          setLoading(false);
        }
      }
    };
    
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

  if (loading) {
    return <div className="flex items-center justify-center h-full bg-secondary/30 rounded-lg">Loading video...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full bg-secondary/30 rounded-lg text-destructive">{error}</div>;
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
    />
  );
};

export default StorageVideoPlayer;
