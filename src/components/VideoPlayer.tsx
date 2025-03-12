
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  controls?: boolean;
  onLoadedData?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  autoPlay = false,
  muted = false,
  loop = false,
  className = '',
  controls = true,
  onLoadedData,
  videoRef,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src) {
      console.log('No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      return;
    }
    
    console.log(`Loading video: ${src}`);
    
    const video = videoRef?.current || internalVideoRef.current;
    if (!video) {
      console.error('Video element reference not available');
      return;
    }
    
    // Reset error state when changing sources
    setError(null);
    setIsLoading(true);
    
    // Simplified event handlers
    const handleLoadedData = () => {
      console.log(`Video loaded successfully: ${src}`);
      setIsLoading(false);
      if (onLoadedData) onLoadedData();
    };
    
    const handleError = () => {
      const errorMsg = video.error 
        ? `Error ${video.error.code}: ${video.error.message}` 
        : 'Unknown video error';
      
      console.error(`Video error for ${src}: ${errorMsg}`);
      
      // For localStorage-based videos, suggest possible solutions
      if (src.startsWith('blob:')) {
        setError(`Cannot load video. The blob URL may have expired since the app was refreshed.`);
      } else {
        setError(errorMsg);
      }
      setIsLoading(false);
    };
    
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    // Stop any current playback
    video.pause();
    
    // Set the video source
    try {
      video.src = src;
      video.load();
      
      // Auto-play if requested (and only after setting the source)
      if (autoPlay) {
        video.play().catch(e => {
          console.warn('Autoplay prevented:', e);
          // Don't treat autoplay prevention as an error
        });
      }
    } catch (err) {
      console.error('Error setting up video:', err);
      setError(`Setup error: ${err}`);
      setIsLoading(false);
    }
    
    // Cleanup
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      
      // Cleanup video element
      video.pause();
      video.src = '';
      video.load();
    };
  }, [src, autoPlay, onLoadedData, videoRef]);

  const handleRetry = () => {
    const video = videoRef?.current || internalVideoRef.current;
    if (!video) return;
    
    setError(null);
    setIsLoading(true);
    
    video.pause();
    
    video.src = src;
    video.load();
    toast.info('Attempting to reload video...');
    
    if (autoPlay) {
      video.play().catch(e => {
        console.warn('Autoplay prevented on retry:', e);
      });
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <div className="text-destructive text-center p-4 bg-white/90 rounded-lg shadow-lg max-w-[80%]">
            <p className="font-medium">Error loading video</p>
            <p className="text-xs text-muted-foreground mt-1 mb-2 break-words">{error}</p>
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
        ref={videoRef || internalVideoRef}
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
