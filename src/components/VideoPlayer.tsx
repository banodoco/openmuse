
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
  
  // Reset loading state when src changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [src]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Manual loading state tracking
    let isVideoLoaded = false;
    
    const handleCanPlay = () => {
      console.log("Video can play:", src);
      if (!isVideoLoaded) {
        isVideoLoaded = true;
        setIsLoading(false);
      }
    };

    const handleLoadedData = () => {
      console.log("Video loaded data:", src);
      if (onLoadedData) onLoadedData();
      
      // Fallback in case canplay doesn't fire
      if (!isVideoLoaded) {
        isVideoLoaded = true;
        setIsLoading(false);
      }
    };

    const handlePlaying = () => {
      console.log("Video is playing:", src);
      if (!isVideoLoaded) {
        isVideoLoaded = true;
        setIsLoading(false);
      }
    };

    const handleError = (e: Event) => {
      console.error("Video loading error:", e);
      setIsLoading(false);
      setHasError(true);
    };

    // Set up event listeners
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('error', handleError);
    
    // Set a backup timeout (3 seconds)
    const timeoutId = setTimeout(() => {
      console.log("Force loading complete after timeout");
      if (!isVideoLoaded) {
        isVideoLoaded = true;
        setIsLoading(false);
      }
    }, 3000);
    
    // Force load the video
    videoElement.load();
    
    return () => {
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('error', handleError);
      clearTimeout(timeoutId);
    };
  }, [src, onLoadedData]);

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
                  
                  // Try to play if autoplay is enabled
                  if (autoPlay) {
                    videoRef.current.play().catch(err => {
                      console.warn("Could not autoplay after retry:", err);
                    });
                  }
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
      >
        <source src={src} type="video/mp4" />
        <source src={src} type="video/webm" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
