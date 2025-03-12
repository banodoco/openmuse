
import React, { useRef, useState, useEffect } from 'react';
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
    if (!src) return;
    setIsLoading(true);
    setHasError(false);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let timeoutId: number;

    // Simple handlers
    const handleLoaded = () => {
      console.log("Video loaded successfully:", src);
      setIsLoading(false);
      if (onLoadedData) onLoadedData();
      
      // If autoPlay is enabled, explicitly try to play
      if (autoPlay && video.paused) {
        video.play().catch(err => {
          console.warn("AutoPlay failed:", err);
        });
      }
    };

    const handleError = () => {
      console.error("Error loading video:", src);
      setIsLoading(false);
      setHasError(true);
    };

    // Set timeout as fallback (shorter - 1.5 seconds)
    timeoutId = window.setTimeout(() => {
      console.log("Timeout reached, forcing load complete for:", src);
      setIsLoading(false);
    }, 1500);

    // Event listeners - using fewer, more reliable events
    video.addEventListener('canplay', handleLoaded);
    video.addEventListener('error', handleError);

    // Explicitly load the video
    video.load();

    return () => {
      video.removeEventListener('canplay', handleLoaded);
      video.removeEventListener('error', handleError);
      clearTimeout(timeoutId);
    };
  }, [src, autoPlay, onLoadedData]);

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
        className={cn("w-full h-full rounded-lg object-cover", className)}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        preload="auto"
        style={{ opacity: isLoading ? 0 : 1 }}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
