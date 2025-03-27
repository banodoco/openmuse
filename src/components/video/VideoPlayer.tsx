
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

  // Setup hover behavior
  useVideoHover(containerRef, videoRef, {
    enabled: playOnHover,
    resetOnLeave: true
  });

  useEffect(() => {
    const isBlobUrl = src?.startsWith('blob:');
    logger.log(`Source changed to: ${src?.substring(0, 30)}...`);
    logger.log(`Is source a blob URL: ${isBlobUrl}`);
    logger.log(`Current page: ${window.location.pathname}`);
    
    // For blob URLs, let's try to auto-convert right away
    if (isBlobUrl) {
      logger.log('Attempting to auto-convert blob URL on source change');
      convertBlobToDataUrl(src)
        .then(dataUrl => {
          if (dataUrl !== src) {
            logger.log('Auto-conversion successful, will use data URL');
            // We don't set it right now, it will happen in the next useEffect
          }
        })
        .catch(err => {
          logger.error('Auto-conversion failed:', err);
        });
    }
  }, [src]);

  useEffect(() => {
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setIsFallbackAttempted(false);
    setConversionAttempted(false);
    
    if (!src) {
      logger.log('No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
      return;
    }
    
    const processSource = async () => {
      try {
        // For blob URLs, try to convert to data URL to avoid cross-origin issues
        if (src.startsWith('blob:')) {
          logger.log(`Processing blob URL: ${src.substring(0, 30)}...`);
          try {
            setConversionAttempted(true);
            const dataUrl = await convertBlobToDataUrl(src);
            if (dataUrl !== src) {
              logger.log('Successfully converted blob URL to data URL');
              setProcessedSrc(dataUrl);
            } else {
              // If regular conversion failed, try image-based conversion
              logger.log('First conversion method failed, trying image-based conversion');
              const imageDataUrl = await createDataUrlFromImage(src);
              if (imageDataUrl !== src) {
                logger.log('Image-based conversion successful');
                setProcessedSrc(imageDataUrl);
              } else {
                logger.log('Could not convert blob URL, using original');
                setProcessedSrc(src);
              }
            }
          } catch (error) {
            logger.error('Error converting blob URL:', error);
            setProcessedSrc(src);
          }
        } else if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/')) {
          logger.log(`Using data or regular URL: ${src.substring(0, 30)}...`);
          setProcessedSrc(src);
        } else {
          logger.error(`Unsupported source format: ${src.substring(0, 30)}...`);
          setError('Unsupported video format');
          setIsLoading(false);
          if (onError) onError('Unsupported video format');
        }
      } catch (err) {
        logger.error('Error in source processing:', err);
        setProcessedSrc(src); // Fall back to original source
      }
    };
    
    processSource();
  }, [src, onError]);

  useEffect(() => {
    if (!processedSrc) {
      return;
    }
    
    logger.log(`Loading video: ${processedSrc.substring(0, 50)}...`);
    
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
      logger.error(`Video error code: ${video.error?.code}`);
      logger.error(`Video error message: ${video.error?.message}`);
      
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
            
            // If all conversions fail, show the error
            setError(message);
            setErrorDetails(details);
            setIsLoading(false);
            if (onError) onError(message);
          })
          .catch(convErr => {
            logger.error('Fallback conversion failed:', convErr);
            setError(message);
            setErrorDetails(details);
            setIsLoading(false);
            if (onError) onError(message);
          });
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
  }, [processedSrc, autoPlay, muted, onLoadedData, videoRef, onError, posterImage, playOnHover, isFallbackAttempted]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    logger.log(`Retrying video load for: ${processedSrc.substring(0, 30)}...`);
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    setIsFallbackAttempted(false);
    setConversionAttempted(false);
    
    video.pause();
    
    // Try to get a fresh version of the src
    if (src.startsWith('blob:')) {
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
            logger.log('All conversion methods failed, using original');
            setProcessedSrc(src);
          }
        })
        .catch(err => {
          logger.error('Retry conversion failed:', err);
          setProcessedSrc(src);
        });
    } else {
      // For other URLs, just reload
      video.src = src;
      video.load();
    }
  };

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
