
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { useVideoHover } from '@/hooks/useVideoHover';
import { attemptVideoPlay, getVideoErrorMessage, isValidVideoUrl, getVideoFormat } from '@/lib/utils/videoUtils';
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
  const [isBlobUrl, setIsBlobUrl] = useState<boolean>(src?.startsWith('blob:') || false);

  // Setup hover behavior
  useVideoHover(containerRef, videoRef, {
    enabled: playOnHover,
    resetOnLeave: true
  });

  // Validate video source
  useEffect(() => {
    setIsBlobUrl(src?.startsWith('blob:') || false);
    
    if (!src) {
      logger.error('No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
      return;
    }
    
    // Allow blob URLs to pass validation
    if (!isBlobUrl && !isValidVideoUrl(src)) {
      const format = getVideoFormat(src);
      const errorMsg = `Invalid video source: ${src.substring(0, 50)}...`;
      logger.error(errorMsg);
      setError(`The video URL appears to be invalid or inaccessible`);
      setErrorDetails(`Source doesn't appear to be a playable video URL. Format detected: ${format}`);
      setIsLoading(false);
      if (onError) onError(errorMsg);
    }
  }, [src, onError, isBlobUrl]);

  // Handle video element setup when src changes
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
    
    logger.log(`Loading video with source: ${src.substring(0, 50)}...`);
    
    const video = videoRef.current;
    if (!video) {
      logger.error('Video element reference not available');
      return;
    }
    
    const handleLoadedData = () => {
      logger.log(`Video loaded successfully: ${src.substring(0, 30)}...`);
      setIsLoading(false);
      if (onLoadedData) onLoadedData();
      
      // Don't autoplay if we're using hover to play
      if (autoPlay && !playOnHover) {
        attemptVideoPlay(video, muted);
      }
    };
    
    const handleError = () => {
      const { message, details } = getVideoErrorMessage(video.error, src);
      const format = getVideoFormat(src);
      
      // Special message for blob URLs
      if (isBlobUrl) {
        setError('The temporary preview cannot be played');
        setErrorDetails('This may be due to the blob URL being created in a different browser context or session');
        setIsLoading(false);
        if (onError) onError('Blob URL cannot be played: ' + message);
        return;
      }
      
      logger.error(`Video error for ${src.substring(0, 30)}...: ${message}`);
      logger.error(`Video error details: ${details}`);
      logger.error(`Detected format: ${format}`);
      
      setError(message);
      setErrorDetails(details + ` Detected format: ${format}`);
      setIsLoading(false);
      if (onError) onError(message);
    };
    
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    // Always pause first to ensure consistent state
    video.pause();
    
    try {
      video.preload = "auto"; // Ensure video preloads
      video.src = src;
      if (poster) {
        video.poster = poster;
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
  }, [src, autoPlay, muted, onLoadedData, videoRef, onError, poster, playOnHover, isBlobUrl]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    logger.log(`Retrying video load for: ${src.substring(0, 30)}...`);
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    
    // Simply reload the video
    video.load();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-lg">
      {isLoading && <VideoLoader posterImage={poster} />}
      
      {error && !onError && (
        <VideoError 
          error={error} 
          errorDetails={errorDetails} 
          onRetry={handleRetry}
          videoSource={src}
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
        poster={poster || undefined}
        preload="auto"
        src={src}
        crossOrigin="anonymous"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
