
import React, { useState, useEffect } from 'react';
import VideoPlayer from './video/VideoPlayer';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';
import { supabase } from '@/integrations/supabase/client';

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

  // Load the video URL
  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // If videoLocation is already a URL, use it directly
        if (videoLocation.startsWith('http') || videoLocation.startsWith('https')) {
          logger.log('Using direct URL for video');
          setVideoUrl(videoLocation);
          setLoading(false);
          return;
        }
        
        // If it looks like a UUID, try to get media record from database
        if (videoLocation.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          logger.log('Looking up media URL from database');
          
          // Query the media table for the permanent URL
          const { data, error } = await supabase
            .from('media')
            .select('url')
            .eq('id', videoLocation)
            .maybeSingle();
            
          if (error) {
            throw new Error(`Database error: ${error.message}`);
          }
          
          if (data && data.url) {
            logger.log(`Found permanent URL in database: ${data.url.substring(0, 30)}...`);
            setVideoUrl(data.url);
            setLoading(false);
            return;
          }
        }
        
        // If we couldn't get a URL, use the location as the URL
        logger.log('Using location as URL');
        setVideoUrl(videoLocation);
        setLoading(false);
      } catch (error) {
        logger.error('Error loading video:', error);
        setError(`Failed to load video: ${error instanceof Error ? error.message : String(error)}`);
        setErrorDetails(String(error));
        setLoading(false);
      }
    };
    
    if (videoLocation) {
      loadVideo();
    }
    
    return () => {
      isMounted = false;
    };
  }, [videoLocation]);

  const handleError = (message: string) => {
    setError(message);
  };

  const handleRetry = () => {
    // Simply reload the URL from the source
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    
    // Force a refresh by adding a cache buster to the URL
    if (videoUrl.includes('?')) {
      setVideoUrl(`${videoUrl}&_t=${Date.now()}`);
    } else {
      setVideoUrl(`${videoUrl}?_t=${Date.now()}`);
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
