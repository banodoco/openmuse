
import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  controls?: boolean;
  onLoadedData?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  autoPlay = false,
  muted = false,
  loop = false,
  className = '',
  controls = true,
  onLoadedData,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Reset states when src changes
    setIsLoading(true);
    setHasError(false);
    setIsPlaying(false);

    const handleLoadedData = () => {
      console.log("Video loaded successfully:", src);
      setIsLoading(false);
      setHasError(false);
      if (onLoadedData) onLoadedData();
    };

    const handleError = (e: Event) => {
      console.error("Video loading error:", e);
      setIsLoading(false);
      setHasError(true);
    };

    const handlePlay = () => {
      console.log("Video playing:", src);
      setIsPlaying(true);
    };

    const handleCanPlay = () => {
      console.log("Video can play:", src);
      setIsLoading(false);
    };

    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('canplay', handleCanPlay);
    
    // Add a fallback timeout in case the events don't fire
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.log("Video loading timeout, forcing state update");
        setIsLoading(false);
        
        // Check if video is actually playing despite loading indicator
        if (videoElement.currentTime > 0 && !videoElement.paused && !videoElement.ended) {
          console.log("Video is playing but loading state wasn't cleared");
          setIsPlaying(true);
        }
      }
    }, 2000); // Reduced timeout from 5000ms to 2000ms
    
    return () => {
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('canplay', handleCanPlay);
      clearTimeout(loadingTimeout);
    };
  }, [src, onLoadedData, isLoading]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      {isLoading && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-sm">
          <div className="text-destructive text-center p-4">
            <p>Error loading video</p>
            <button 
              className="mt-2 text-sm underline"
              onClick={() => {
                if (videoRef.current) {
                  setIsLoading(true);
                  setHasError(false);
                  videoRef.current.load();
                }
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        className={cn(
          "w-full h-full rounded-lg object-cover transition-opacity duration-300",
          (isLoading && !isPlaying) ? "opacity-0" : "opacity-100",
          className
        )}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        onTimeUpdate={() => {
          if (isLoading && videoRef.current && videoRef.current.currentTime > 0) {
            setIsLoading(false);
            setIsPlaying(true);
          }
        }}
      />
    </div>
  );
};

export default VideoPlayer;
