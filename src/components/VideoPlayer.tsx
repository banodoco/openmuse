
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
  const loadingTimeoutRef = useRef<number | null>(null);
  
  // Reset loading state when src changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [src]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Clean up function for all event listeners
    const cleanup = () => {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('canplaythrough', handleCanPlayThrough);
      videoElement.removeEventListener('playing', handlePlaying);
    };

    const handleLoadedData = () => {
      console.log("Video loaded data successfully:", src);
      if (onLoadedData) onLoadedData();
    };

    const handleError = (e: Event) => {
      console.error("Video loading error:", e);
      setIsLoading(false);
      setHasError(true);
    };

    const handleCanPlayThrough = () => {
      console.log("Video can play through:", src);
      setIsLoading(false);
    };
    
    const handlePlaying = () => {
      console.log("Video is now playing:", src);
      setIsLoading(false);
    };

    // Set up a fallback timeout
    if (loadingTimeoutRef.current) {
      window.clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = window.setTimeout(() => {
      console.log("Force loading complete after timeout");
      setIsLoading(false);
    }, 2000); // Increased timeout to give more time for loading

    // Force video to load
    videoElement.load();
    
    // Add event listeners
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('canplaythrough', handleCanPlayThrough);
    videoElement.addEventListener('playing', handlePlaying);
    
    return cleanup;
  }, [src, onLoadedData]);

  // Get current playback info
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && isLoading && video.currentTime > 0) {
      console.log("Video is playing, forcing loading complete");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      {isLoading && (
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
          "w-full h-full rounded-lg object-cover",
          className
        )}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        style={{ opacity: isLoading ? 0 : 1 }}
        preload="auto"
      />
    </div>
  );
};

export default VideoPlayer;
