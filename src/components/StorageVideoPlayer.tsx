
import React, { useEffect, useState, useCallback } from 'react';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import VideoPlayer from './video/VideoPlayer';
import { convertBlobToDataUrl, createDataUrlFromImage } from '@/lib/utils/videoUtils';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const LOCAL_STORAGE_URL_KEY_PREFIX = 'video_url_cache_';

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
  const [retryCount, setRetryCount] = useState<number>(0);

  // Helper to save URL to localStorage
  const cacheVideoUrl = useCallback((location: string, url: string) => {
    try {
      if (url && !url.startsWith('blob:')) {
        const storageKey = `${LOCAL_STORAGE_URL_KEY_PREFIX}${location}`;
        localStorage.setItem(storageKey, JSON.stringify({
          url,
          timestamp: Date.now()
        }));
        logger.log(`Cached URL for ${location} in localStorage`);
      }
    } catch (err) {
      logger.error('Error caching URL in localStorage:', err);
    }
  }, []);

  // Helper to retrieve cached URL from localStorage
  const getCachedVideoUrl = useCallback((location: string): string | null => {
    try {
      const storageKey = `${LOCAL_STORAGE_URL_KEY_PREFIX}${location}`;
      const cachedData = localStorage.getItem(storageKey);
      
      if (cachedData) {
        const { url, timestamp } = JSON.parse(cachedData);
        // Cache expires after 7 days (604800000 ms) instead of 24 hours
        if (Date.now() - timestamp < 604800000) {
          logger.log(`Using cached URL for ${location} from localStorage`);
          return url;
        } else {
          logger.log(`Cached URL for ${location} has expired`);
          localStorage.removeItem(storageKey);
        }
      }
      return null;
    } catch (err) {
      logger.error('Error retrieving cached URL from localStorage:', err);
      return null;
    }
  }, []);

  const getPermalink = useCallback(async (location: string): Promise<string | null> => {
    try {
      // Check if this is a Supabase Storage URL
      if (location.includes('supabase.co/storage')) {
        logger.log('Already have a Supabase storage URL, using it directly');
        return location;
      }
      
      // If it's a UUID, try to get the media record directly
      if (location.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        logger.log('Looking up media by ID:', location);
        const { data, error } = await supabase
          .from('media')
          .select('url')
          .eq('id', location)
          .single();
        
        if (!error && data?.url) {
          logger.log('Found permanent URL in database:', data.url);
          return data.url;
        }
      }
      
      // If we can't determine a permanent URL, return null
      return null;
    } catch (err) {
      logger.error('Error getting permalink:', err);
      return null;
    }
  }, []);

  const loadVideo = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      setErrorDetails(null);
      
      logger.log(`Loading video from location: ${videoLocation}, forceRefresh: ${forceRefresh}`);
      
      // First check localStorage cache if not forcing refresh
      let url = !forceRefresh ? getCachedVideoUrl(videoLocation) : null;
      
      if (!url) {
        // Try to get a permanent URL
        url = await getPermalink(videoLocation);
        
        // If no permanent URL, use videoUrlService
        if (!url) {
          try {
            if (forceRefresh) {
              url = await videoUrlService.forceRefreshUrl(videoLocation);
            } else {
              url = await videoUrlService.getVideoUrl(videoLocation);
            }
          } catch (dbErr) {
            logger.error('Error fetching from videoUrlService:', dbErr);
          }
        }
        
        // Direct database check as a fallback
        if (!url && videoLocation.includes('-')) {
          logger.log('Trying direct database lookup as fallback');
          const { data, error } = await supabase
            .from('media')
            .select('url')
            .eq('id', videoLocation)
            .single();
          
          if (!error && data?.url) {
            url = data.url;
            logger.log('Successfully retrieved permanent URL from direct database lookup');
          }
        }
      }
      
      if (!url) {
        // Last resort: use the location itself as the URL
        if (videoLocation.startsWith('http') || videoLocation.startsWith('data:')) {
          logger.log('Using video location itself as URL');
          url = videoLocation;
        } else {
          setError('Video could not be loaded from storage');
          setLoading(false);
          return;
        }
      }
      
      // For blob URLs, convert to data URL to avoid expiration issues
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
          setErrorDetails(`Conversion error: ${conversionError}`);
        }
      }
      
      // Cache the resolved URL in localStorage for future use
      if (url && !url.startsWith('blob:')) {
        cacheVideoUrl(videoLocation, url);
      }
      
      setVideoUrl(url);
      setLoading(false);
    } catch (error) {
      logger.error('Error loading video:', error);
      setError('An error occurred while loading the video');
      setErrorDetails(`${error}`);
      setLoading(false);
    }
  }, [videoLocation, getCachedVideoUrl, cacheVideoUrl, getPermalink]);

  useEffect(() => {
    let isMounted = true;
    
    if (videoLocation) {
      loadVideo();
    }
    
    // Listen for URL refresh events
    const handleUrlRefreshed = (event: CustomEvent) => {
      if (event.detail.original === videoLocation) {
        logger.log(`URL refresh event detected for: ${videoLocation}`);
        if (isMounted) {
          const newUrl = event.detail.fresh;
          setVideoUrl(newUrl);
          cacheVideoUrl(videoLocation, newUrl);
        }
      }
    };
    
    // Add event listener for URL refresh events
    document.addEventListener('videoUrlRefreshed', handleUrlRefreshed as EventListener);
    
    return () => {
      isMounted = false;
      // Clean up object URL if it was created
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
      // Remove event listener
      document.removeEventListener('videoUrlRefreshed', handleUrlRefreshed as EventListener);
    };
  }, [videoLocation, cacheVideoUrl, loadVideo]);

  // Add auto-retry logic if video fails to load
  useEffect(() => {
    if (error && retryCount < 2) {
      const timer = setTimeout(() => {
        logger.log(`Auto-retrying video load (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        loadVideo(true); // Force refresh on auto-retry
      }, 3000); // Wait 3 seconds before retry
      
      return () => clearTimeout(timer);
    }
  }, [error, retryCount, loadVideo]);

  const handleError = (message: string) => {
    setError(message);
  };

  const handleRetry = () => {
    setRetryCount(0);
    loadVideo(true);
    toast.info('Refreshing video...');
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
