
import { useState, useEffect } from 'react';
import { Logger } from '@/lib/logger';
import { videoUrlService } from '@/lib/services/videoUrlService';

const logger = new Logger('useVideoUrl');

interface UseVideoUrlProps {
  videoLocation: string;
  previewMode?: boolean;
  isBlobUrl: boolean;
  forcePreload?: boolean;
  lazyLoad?: boolean;
  onError?: (message: string, details?: string) => void;
  isMobile?: boolean;
}

export function useVideoUrl({
  videoLocation,
  previewMode = false,
  isBlobUrl,
  forcePreload = false,
  lazyLoad = true,
  onError,
  isMobile = false
}: UseVideoUrlProps) {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // On mobile, we NEVER auto-load the video - just get the poster frame
  const [shouldLoadVideo, setShouldLoadVideo] = useState(!lazyLoad || forcePreload || (isMobile ? false : true));
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    if (forcePreload && !isMobile) {
      setShouldLoadVideo(true);
    }
  }, [forcePreload, isMobile]);

  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!videoLocation) {
          throw new Error('No video location provided');
        }
        
        // Only attempt to get video URL if we need to load the video
        if (shouldLoadVideo) {
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
          
          if (isMounted) {
            setVideoUrl(url);
            setLoading(false);
            setVideoLoaded(true);
            logger.log('Video URL loaded and ready');
          }
        } else {
          // If we're not loading the video yet, just mark loading as done
          setLoading(false);
        }
      } catch (error) {
        logger.error('Error loading video:', error);
        if (isMounted) {
          const errorMsg = `Failed to load video: ${error instanceof Error ? error.message : String(error)}`;
          setError(errorMsg);
          setErrorDetails(String(error));
          setLoading(false);
          if (onError) onError(errorMsg, String(error));
        }
      }
    };
    
    if (videoLocation) {
      loadVideo();
    }
    
    return () => {
      isMounted = false;
    };
  }, [videoLocation, retryCount, previewMode, isBlobUrl, shouldLoadVideo, onError]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setRetryCount(prev => prev + 1);
    setShouldLoadVideo(true);
  };

  const triggerLoad = () => {
    if (!shouldLoadVideo && !isMobile) {
      setShouldLoadVideo(true);
    }
  };

  return {
    videoUrl,
    loading,
    error,
    errorDetails,
    retryCount,
    shouldLoadVideo: isMobile ? false : shouldLoadVideo, // Never load video on mobile
    videoLoaded,
    setVideoLoaded,
    handleRetry,
    triggerLoad
  };
}
