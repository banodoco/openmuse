
import React, { useEffect, useState } from 'react';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import VideoPlayer from './VideoPlayer';

interface StorageVideoPlayerProps {
  videoLocation: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = ({
  videoLocation,
  className,
  controls = true,
  autoPlay = false,
  muted = false,
  loop = false
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
        
        // Get database instance
        const db = await databaseSwitcher.getDatabase();
        
        // Get the actual URL for the video
        const url = await db.getVideoUrl(videoLocation);
        
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
          console.error('Error loading video:', error);
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
    />
  );
};

export default StorageVideoPlayer;
