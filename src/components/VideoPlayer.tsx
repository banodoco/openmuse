
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

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Reset states when src changes
    setIsLoading(true);
    setHasError(false);

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

    const handleCanPlayThrough = () => {
      console.log("Video can play through:", src);
      setIsLoading(false);
    };

    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('canplaythrough', handleCanPlayThrough);
    
    return () => {
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [src, onLoadedData]);

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
          "w-full h-full rounded-lg object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
      />
    </div>
  );
};

export default VideoPlayer;
