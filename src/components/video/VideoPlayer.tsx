
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { useVideoHover } from '@/hooks/useVideoHover';
import { attemptVideoPlay, getVideoErrorMessage } from '@/lib/utils/videoUtils';
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
  onLoadedData?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onError?: (message: string) => void;
  poster?: string;
  playOnHover?: boolean;
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
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [processedSrc, setProcessedSrc] = useState<string>('');
  const [posterImage, setPosterImage] = useState<string | null>(poster || null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Setup hover behavior
  useVideoHover(containerRef, videoRef, {
    enabled: playOnHover,
    resetOnLeave: true
  });

  useEffect(() => {
    logger.log(`Source changed to: ${src?.substring(0, 30)}...`);
  }, [src]);

  useEffect(() => {
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    
    if (!src) {
      logger.log('No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
      return;
    }
    
    if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/')) {
      logger.log(`Using data or regular URL: ${src.substring(0, 30)}...`);
      setProcessedSrc(src);
    } 
    else if (src.startsWith('blob:')) {
      logger.log(`Using blob URL: ${src.substring(0, 30)}...`);
      setProcessedSrc(src);
    }
    else {
      logger.error(`Unsupported source format: ${src.substring(0, 30)}...`);
      setError('Unsupported video format');
      setIsLoading(false);
      if (onError) onError('Unsupported video format');
    }
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
    
    const handleLoadedData = (e: Event) => {
      logger.log(`Video loaded successfully: ${processedSrc.substring(0, 30)}...`);
      setIsLoading(false);
      
      if (onLoadedData) {
        // Cast the event to a React synthetic event
        const syntheticEvent = e as unknown as React.SyntheticEvent<HTMLVideoElement>;
        onLoadedData(syntheticEvent);
      }
      
      // Don't autoplay if we're using hover to play
      if (autoPlay && !playOnHover) {
        attemptVideoPlay(video, muted);
      }
    };
    
    const handleError = () => {
      const { message, details } = getVideoErrorMessage(video.error, processedSrc);
      
      logger.error(`Video error for ${processedSrc.substring(0, 30)}...: ${message}`);
      
      setError(message);
      setErrorDetails(details);
      setIsLoading(false);
      
      if (onError) onError(message);
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
  }, [processedSrc, autoPlay, muted, onLoadedData, videoRef, onError, posterImage, playOnHover]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    
    video.pause();
    
    video.src = src;
    video.load();
    
    if (autoPlay && !playOnHover) {
      attemptVideoPlay(video, muted);
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
        <source src={src} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
