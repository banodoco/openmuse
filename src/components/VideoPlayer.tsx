
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
  const [processedSrc, setProcessedSrc] = useState<string>('');

  // Log source changes
  useEffect(() => {
    console.log(`[VideoPlayer] Source changed to: ${src?.substring(0, 30)}...`);
  }, [src]);

  useEffect(() => {
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    
    if (!src) {
      console.log('[VideoPlayer] No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      return;
    }
    
    if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/')) {
      console.log(`[VideoPlayer] Using data or regular URL: ${src.substring(0, 30)}...`);
      setProcessedSrc(src);
    } 
    else if (src.startsWith('blob:')) {
      console.log(`[VideoPlayer] Using blob URL: ${src.substring(0, 30)}...`);
      setProcessedSrc(src);
    }
    else {
      console.error(`[VideoPlayer] Unsupported source format: ${src.substring(0, 30)}...`);
      setError('Unsupported video format');
      setIsLoading(false);
    }
  }, [src]);

  useEffect(() => {
    if (!processedSrc) {
      return;
    }
    
    console.log(`[VideoPlayer] Loading video: ${processedSrc.substring(0, 50)}...`);
    
    const video = videoRef?.current || internalVideoRef.current;
    if (!video) {
      console.error('[VideoPlayer] Video element reference not available');
      return;
    }
    
    const handleLoadedData = () => {
      console.log(`[VideoPlayer] Video loaded successfully: ${processedSrc.substring(0, 30)}...`);
      setIsLoading(false);
      if (onLoadedData) onLoadedData();
    };
    
    const handleError = () => {
      const videoError = video.error;
      const errorMsg = videoError 
        ? `Error ${videoError.code}: ${videoError.message}` 
        : 'Unknown video error';
      
      console.error(`[VideoPlayer] Video error for ${processedSrc.substring(0, 30)}...: ${errorMsg}`);
      
      let details = '';
      if (videoError) {
        details += `Code: ${videoError.code}\n`;
        details += `Message: ${videoError.message}\n`;
        
        if (videoError.code === 4) {
          details += 'This is a format error, which typically means the video format is not supported or the file is corrupted.\n';
        }
      }
      
      if (processedSrc.startsWith('blob:')) {
        setError(`Cannot load blob video. The URL may have expired since your last refresh.`);
        details += 'Blob URLs are temporary and expire when the page is refreshed.\n';
      } else if (processedSrc.startsWith('data:')) {
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
    
    video.pause();
    
    try {
      video.src = processedSrc;
      video.load();
      
      if (autoPlay) {
        video.play().catch(e => {
          console.warn('[VideoPlayer] Autoplay prevented:', e);
        });
      }
    } catch (err) {
      console.error('[VideoPlayer] Error setting up video:', err);
      setError(`Setup error: ${err}`);
      setIsLoading(false);
    }
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      
      video.pause();
      video.src = '';
      video.load();
    };
  }, [processedSrc, autoPlay, onLoadedData, videoRef]);

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
