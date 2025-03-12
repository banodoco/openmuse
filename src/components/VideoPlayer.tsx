
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
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    if (!src) {
      console.log('[VideoPlayer] No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      return;
    }
    
    console.log(`[VideoPlayer] Loading video: ${src.substring(0, 50)}...`);
    
    const video = videoRef?.current || internalVideoRef.current;
    if (!video) {
      console.error('[VideoPlayer] Video element reference not available');
      return;
    }
    
    // Reset error state when changing sources
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    
    // Simplified event handlers
    const handleLoadedData = () => {
      console.log(`[VideoPlayer] Video loaded successfully: ${src.substring(0, 30)}...`);
      setIsLoading(false);
      if (onLoadedData) onLoadedData();
    };
    
    const handleError = () => {
      const videoError = video.error;
      const errorMsg = videoError 
        ? `Error ${videoError.code}: ${videoError.message}` 
        : 'Unknown video error';
      
      console.error(`[VideoPlayer] Video error for ${src.substring(0, 30)}...: ${errorMsg}`);
      
      // For more detailed debugging
      let details = '';
      if (videoError) {
        details += `Code: ${videoError.code}\n`;
        details += `Message: ${videoError.message}\n`;
        
        if (videoError.code === 4) {
          details += 'This is a format error, which typically means the video format is not supported or the file is corrupted.\n';
        }
      }
      
      // Different messages based on URL type
      if (src.startsWith('blob:')) {
        setError(`Cannot load blob video. The URL may have expired since your last refresh.`);
        details += 'Blob URLs are temporary and expire when the page is refreshed.\n';
      } else if (src.startsWith('data:')) {
        setError(`Cannot load data URL video. The encoding may be incorrect.`);
        details += 'Data URLs might be too large or improperly encoded.\n';
      } else {
        setError(errorMsg);
      }
      
      setErrorDetails(details);
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
          console.warn('[VideoPlayer] Autoplay prevented:', e);
          // Don't treat autoplay prevention as an error
        });
      }
    } catch (err) {
      console.error('[VideoPlayer] Error setting up video:', err);
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
    setErrorDetails('');
    setIsLoading(true);
    
    video.pause();
    
    video.src = src;
    video.load();
    toast.info('Attempting to reload video...');
    
    if (autoPlay) {
      video.play().catch(e => {
        console.warn('[VideoPlayer] Autoplay prevented on retry:', e);
      });
    }
  };

  const handleShowErrorDetails = () => {
    toast.info(errorDetails || 'No additional error details available');
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
            <div className="flex gap-2 justify-center mt-2">
              <button 
                className="text-sm font-medium bg-primary text-white px-3 py-1 rounded-md"
                onClick={handleRetry}
              >
                Try again
              </button>
              {errorDetails && (
                <button 
                  className="text-sm font-medium bg-secondary text-primary px-3 py-1 rounded-md"
                  onClick={handleShowErrorDetails}
                >
                  More info
                </button>
              )}
            </div>
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
