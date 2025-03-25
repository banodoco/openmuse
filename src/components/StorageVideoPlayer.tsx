
import React, { useEffect, useState } from 'react';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import VideoPlayer from './video/VideoPlayer';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface StorageVideoPlayerProps {
  videoLocation: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playOnHover?: boolean;
  aspectRatio?: number;
}

const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = ({
  videoLocation,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  playOnHover = false,
  aspectRatio = 16/9
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
    return (
      <AspectRatio ratio={aspectRatio} className="bg-secondary/30 rounded-lg">
        <div className="flex items-center justify-center h-full">Loading video...</div>
      </AspectRatio>
    );
  }

  if (error) {
    return (
      <AspectRatio ratio={aspectRatio} className="bg-secondary/30 rounded-lg">
        <div className="flex items-center justify-center h-full text-destructive">{error}</div>
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={aspectRatio} className={`overflow-hidden rounded-lg ${className}`}>
      <VideoPlayer
        src={videoUrl}
        className="w-full h-full object-cover"
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playOnHover={playOnHover}
      />
    </AspectRatio>
  );
};

export default StorageVideoPlayer;
