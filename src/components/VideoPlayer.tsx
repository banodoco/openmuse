
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const logEvent = (event: string) => {
      console.log(`Video event (${src.substring(0, 30)}...): ${event}`);
    };

    // Reset video element
    video.pause();
    video.removeAttribute('src');
    video.load();

    // Set up detailed event listeners for debugging
    const eventListeners = [
      { name: 'loadstart', handler: () => logEvent('loadstart') },
      { name: 'durationchange', handler: () => logEvent('durationchange') },
      { name: 'loadedmetadata', handler: () => logEvent('loadedmetadata') },
      { name: 'loadeddata', handler: () => {
        logEvent('loadeddata');
        if (onLoadedData) onLoadedData();
      }},
      { name: 'canplay', handler: () => logEvent('canplay') },
      { name: 'canplaythrough', handler: () => logEvent('canplaythrough') },
      { name: 'error', handler: (e: Event) => {
        const videoElement = e.target as HTMLVideoElement;
        const errorCode = videoElement.error ? videoElement.error.code : 'unknown';
        const errorMessage = videoElement.error ? videoElement.error.message : 'unknown error';
        console.error(`Video error: ${errorCode} - ${errorMessage}`);
        setError(`Error ${errorCode}: ${errorMessage}`);
      }}
    ];

    // Add all event listeners
    eventListeners.forEach(({ name, handler }) => {
      video.addEventListener(name, handler);
    });

    // Try loading the video with both methods
    try {
      video.src = src;
      video.load();
      
      // Attempt playback if autoPlay is true
      if (autoPlay) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn("AutoPlay failed:", err);
            // Don't set error - this is often just autoplay policy restriction
          });
        }
      }
    } catch (err) {
      console.error("Error setting up video:", err);
      setError(`Setup error: ${err}`);
    }

    // Cleanup
    return () => {
      eventListeners.forEach(({ name, handler }) => {
        video.removeEventListener(name, handler);
      });
    };
  }, [src, autoPlay, onLoadedData]);

  const handleRetry = () => {
    setError(null);
    // Re-trigger the effect
    if (videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.src = src;
      video.load();
      if (autoPlay) {
        video.play().catch(err => console.warn("Retry autoplay failed:", err));
      }
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <div className="text-destructive text-center p-4 bg-white/90 rounded-lg shadow-lg">
            <p>Error loading video</p>
            <p className="text-xs text-muted-foreground mt-1 mb-2">{error}</p>
            <button 
              className="mt-2 text-sm font-medium bg-primary text-white px-3 py-1 rounded-md"
              onClick={handleRetry}
            >
              Try again
            </button>
          </div>
        </div>
      )}
      
      <video
        ref={videoRef}
        className={cn("w-full h-full object-cover", className)}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
      >
        <source src={src} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
