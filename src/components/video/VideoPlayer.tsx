
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { useVideoHover } from '@/hooks/useVideoHover';
import { 
  attemptVideoPlay, 
  getVideoErrorMessage, 
  convertBlobToDataUrl,
  createDataUrlFromImage
} from '@/lib/utils/videoUtils';
import VideoError from './VideoError';
import VideoLoader from './VideoLoader';

const logger = new Logger('VideoPlayer');

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  controls?: boolean;
  onLoadedData?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onError?: (message: string) => void;
  poster?: string;
  playOnHover?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  autoPlay = false,
  muted = true,
  loop = false,
  className = '',
  controls = true,
  onLoadedData,
  videoRef: externalVideoRef,
  onError,
  poster,
  playOnHover = false,
  containerRef: externalContainerRef,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [processedSrc, setProcessedSrc] = useState<string>('');
  const [posterImage, setPosterImage] = useState<string | null>(poster || null);
  const [isFallbackAttempted, setIsFallbackAttempted] = useState(false);
  const [conversionAttempted, setConversionAttempted] = useState(false);
  const [useFallbackVideo, setUseFallbackVideo] = useState(false);

  // Setup hover behavior
  useVideoHover(containerRef, videoRef, {
    enabled: playOnHover,
    resetOnLeave: true
  });

  // Auto-convert blob URLs on source change
  useEffect(() => {
    const isBlobUrl = src?.startsWith('blob:');
    logger.log(`Source changed to: ${src?.substring(0, 30)}...`);
    logger.log(`Is source a blob URL: ${isBlobUrl}`);
    
    if (isBlobUrl) {
      logger.log('Attempting to auto-convert blob URL on source change');
      convertBlobToDataUrl(src)
        .then(dataUrl => {
          if (dataUrl !== src) {
            logger.log('Auto-conversion successful, using data URL');
            setProcessedSrc(dataUrl);
            setConversionAttempted(true);
          } else {
            setProcessedSrc(src);
          }
        })
        .catch(err => {
          logger.error('Auto-conversion failed:', err);
          setProcessedSrc(src);
        });
    } else {
      // For non-blob URLs, use as is
      setProcessedSrc(src);
    }
  }, [src]);

  // Handle source processing when src changes
  useEffect(() => {
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setIsFallbackAttempted(false);
    setUseFallbackVideo(false);
    
    if (!src) {
      logger.log('No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
    }
  }, [src, onError]);

  // Handle video element setup when processedSrc changes
  useEffect(() => {
    if (!processedSrc) {
      return;
    }
    
    logger.log(`Loading video with processed source: ${processedSrc.substring(0, 50)}...`);
    
    const video = videoRef.current;
    if (!video) {
      logger.error('Video element reference not available');
      return;
    }
    
    const handleLoadedData = () => {
      logger.log(`Video loaded successfully: ${processedSrc.substring(0, 30)}...`);
      setIsLoading(false);
      if (onLoadedData) onLoadedData();
      
      // Don't autoplay if we're using hover to play
      if (autoPlay && !playOnHover) {
        attemptVideoPlay(video, muted);
      }
    };
    
    const handleError = () => {
      const { message, details } = getVideoErrorMessage(video.error, processedSrc);
      
      logger.error(`Video error for ${processedSrc.substring(0, 30)}...: ${message}`);
      logger.error(`Video error details: ${details}`);
      
      // Check if we need to try fallback to data URL
      const isSecurityError = message.includes('security') || 
                              details.includes('security') || 
                              message.includes('URL safety check') || 
                              details.includes('URL safety check');
      
      if (!isFallbackAttempted && isSecurityError && processedSrc.startsWith('blob:')) {
        logger.log('Attempting fallback to data URL conversion');
        setIsFallbackAttempted(true);
        
        // Try the image-based conversion as a last resort
        createDataUrlFromImage(processedSrc)
          .then(dataUrl => {
            if (dataUrl !== processedSrc) {
              logger.log('Fallback image-based conversion succeeded');
              setProcessedSrc(dataUrl);
              return;
            }
            
            // If all conversions fail, try using a video element with crossOrigin="anonymous"
            logger.log('Trying crossOrigin approach as final fallback');
            setUseFallbackVideo(true);
            setError(null);
            setIsLoading(false);
          })
          .catch(convErr => {
            logger.error('Fallback conversion failed:', convErr);
            // Try crossOrigin approach as last resort
            setUseFallbackVideo(true);
            setError(null);
            setIsLoading(false);
          });
      } else if (isSecurityError && !useFallbackVideo) {
        // If security error and not yet using fallback video, try it
        logger.log('Security error detected, trying crossOrigin video approach');
        setUseFallbackVideo(true);
        setError(null);
        setIsLoading(false);
      } else {
        setError(message);
        setErrorDetails(details);
        setIsLoading(false);
        if (onError) onError(message);
      }
    };
    
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    // Always pause first to ensure consistent state
    video.pause();
    
    try {
      video.preload = "auto"; // Ensure video preloads
      video.src = processedSrc;
      if (posterImage) {
        video.poster = posterImage;
      }
      video.load();
    } catch (err) {
      logger.error('Error setting up video:', err);
      const errorMessage = `Setup error: ${err}`;
      setError(errorMessage);
      setIsLoading(false);
      if (onError) onError(errorMessage);
    }
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      
      video.pause();
      video.src = '';
      video.load();
    };
  }, [processedSrc, autoPlay, muted, onLoadedData, videoRef, onError, posterImage, playOnHover, isFallbackAttempted, useFallbackVideo]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    logger.log(`Retrying video load for: ${processedSrc.substring(0, 30)}...`);
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setIsFallbackAttempted(false);
    setConversionAttempted(false);
    setUseFallbackVideo(false);
    
    // Force reload the source from its original URL
    if (src.startsWith('http') && !src.includes('supabase.co')) {
      // For HTTP URLs (except Supabase), add cache buster
      const cacheBuster = `?t=${Date.now()}`;
      const urlWithCacheBuster = src.includes('?') 
        ? `${src}&_cb=${Date.now()}` 
        : `${src}${cacheBuster}`;
      setProcessedSrc(urlWithCacheBuster);
    } else if (src.startsWith('blob:')) {
      // For blob URLs, try the data URL conversion again
      convertBlobToDataUrl(src)
        .then(dataUrl => {
          if (dataUrl !== src) {
            logger.log('Retry conversion succeeded, using data URL');
            setProcessedSrc(dataUrl);
          } else {
            // If that didn't work, try our image-based conversion
            return createDataUrlFromImage(src);
          }
        })
        .then(imgDataUrl => {
          if (imgDataUrl && imgDataUrl !== src) {
            logger.log('Image-based conversion succeeded on retry');
            setProcessedSrc(imgDataUrl);
          } else {
            // Last resort: try the crossOrigin approach
            setUseFallbackVideo(true);
            setProcessedSrc(src);
          }
        })
        .catch(err => {
          logger.error('Retry conversion failed:', err);
          // Last resort: try the crossOrigin approach
          setUseFallbackVideo(true);
          setProcessedSrc(src);
        });
    } else {
      // For other URLs, just reload
      const reloadedSrc = src + (src.includes('?') ? '&' : '?') + '_reload=' + Date.now();
      setProcessedSrc(reloadedSrc);
    }
  };

  // Render a crossOrigin video element as a fallback
  if (useFallbackVideo && !error) {
    return (
      <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-lg">
        {isLoading && <VideoLoader posterImage={posterImage} />}
        
        <video
          ref={videoRef}
          className={cn("w-full h-full object-cover", className)}
          autoPlay={autoPlay && !playOnHover}
          muted={muted}
          loop={loop}
          controls={controls}
          playsInline
          poster={posterImage || undefined}
          preload="metadata"
          crossOrigin="anonymous"
          src={processedSrc}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-lg">
      {isLoading && <VideoLoader posterImage={posterImage} />}
      
      {error && !onError && (
        <VideoError 
          error={error} 
          errorDetails={errorDetails} 
          onRetry={handleRetry}
          videoSource={processedSrc}
        />
      )}
      
      <video
        ref={videoRef}
        className={cn("w-full h-full object-cover", className)}
        autoPlay={autoPlay && !playOnHover}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        poster={posterImage || undefined}
        preload="metadata"
      >
        <source src={processedSrc} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
