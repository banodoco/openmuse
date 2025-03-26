
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { attemptVideoPlay, getVideoErrorMessage } from '@/lib/utils/videoUtils';
import VideoError from './VideoError';
import VideoLoader from './VideoLoader';

const logger = new Logger('VideoPlayer');

type PlayState = 'playing' | 'paused' | 'hover';

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
  playState?: PlayState;
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
  playState,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [posterImage, setPosterImage] = useState<string | null>(poster || null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const sourceChangeRef = useRef(false);
  
  // Only update poster when poster prop changes
  useEffect(() => {
    if (poster !== posterImage) {
      setPosterImage(poster || null);
    }
  }, [poster]);
  
  // Handle play state changes
  useEffect(() => {
    if (!videoRef.current || isLoading || error) return;
    
    const video = videoRef.current;
    
    if (playState === 'playing' && video.paused) {
      attemptVideoPlay(video, muted);
    } else if (playState === 'hover' && video.paused && playOnHover) {
      attemptVideoPlay(video, muted);
    } else if (playState === 'paused' && !video.paused) {
      video.pause();
    }
  }, [playState, isLoading, error, muted, playOnHover]);

  // Only update the source when it actually changes
  useEffect(() => {
    if (src === currentSrc) return;
    
    sourceChangeRef.current = true;
    logger.log(`Source changed to: ${src?.substring(0, 30)}...`);
    
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
    
    let processedSrc = '';
    
    if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/')) {
      logger.log(`Using data or regular URL: ${src.substring(0, 30)}...`);
      processedSrc = src;
    } 
    else if (src.startsWith('blob:')) {
      logger.log(`Using blob URL: ${src.substring(0, 30)}...`);
      processedSrc = src;
    }
    else {
      logger.error(`Unsupported source format: ${src.substring(0, 30)}...`);
      setError('Unsupported video format');
      setIsLoading(false);
      if (onError) onError('Unsupported video format');
      return;
    }
    
    setCurrentSrc(src);
    
    const video = videoRef.current;
    if (!video) {
      logger.error('Video element reference not available');
      return;
    }
    
    const handleLoadedData = (e: Event) => {
      logger.log(`Video loaded successfully: ${processedSrc.substring(0, 30)}...`);
      setIsLoading(false);
      sourceChangeRef.current = false;
      
      if (onLoadedData && !sourceChangeRef.current) {
        // Cast the event to a React synthetic event
        const syntheticEvent = e as unknown as React.SyntheticEvent<HTMLVideoElement>;
        onLoadedData(syntheticEvent);
      }
      
      // Don't autoplay if we're using hover to play
      if (autoPlay && !playOnHover && !sourceChangeRef.current) {
        attemptVideoPlay(video, muted);
      }
    };
    
    const handleError = () => {
      if (sourceChangeRef.current) {
        const { message, details } = getVideoErrorMessage(video.error, processedSrc);
        
        logger.error(`Video error for ${processedSrc.substring(0, 30)}...: ${message}`);
        
        setError(message);
        setErrorDetails(details);
        setIsLoading(false);
        sourceChangeRef.current = false;
        
        if (onError) onError(message);
      }
    };
    
    // Remove existing handlers (if any)
    video.removeEventListener('loadeddata', handleLoadedData);
    video.removeEventListener('error', handleError);
    
    // Add new handlers
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    // Always pause first to ensure consistent state
    video.pause();
    
    try {
      video.preload = "auto"; // Ensure video preloads
      video.src = processedSrc;
      video.poster = posterImage || '';
      video.load();
    } catch (err) {
      logger.error('Error setting up video:', err);
      const errorMessage = `Setup error: ${err}`;
      setError(errorMessage);
      setIsLoading(false);
      sourceChangeRef.current = false;
      if (onError) onError(errorMessage);
    }
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, [src, onLoadedData, onError, autoPlay, muted, posterImage, playOnHover]);

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    sourceChangeRef.current = true;
    
    video.pause();
    
    video.src = src;
    video.load();
    
    if (autoPlay && !playOnHover) {
      attemptVideoPlay(video, muted);
    }
  };

  // Clean up function to properly dispose of video resources
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.src = '';
        video.load();
      }
    };
  }, []);

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
        <source src={currentSrc} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default React.memo(VideoPlayer);
