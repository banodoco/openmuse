
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
  onError?: (message: string) => void;
  poster?: string;
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
  onError,
  poster,
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [processedSrc, setProcessedSrc] = useState<string>('');
  const [posterImage, setPosterImage] = useState<string | null>(poster || null);

  // Log source changes
  useEffect(() => {
    console.log(`[VideoPlayer] Source changed to: ${src?.substring(0, 30)}...`);
  }, [src]);

  // Generate poster image if not provided and it's a video URL
  useEffect(() => {
    if (!poster && src && !src.startsWith('data:') && !posterImage) {
      // Attempt to create a poster from the first frame
      const generatePoster = async () => {
        try {
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.src = src;
          video.muted = true;
          video.preload = 'metadata';
          
          video.onloadedmetadata = () => {
            video.currentTime = 0.1;
          };
          
          video.onseeked = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 360;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setPosterImage(dataUrl);
              }
              
              // Clean up
              video.pause();
              video.src = '';
              video.load();
            } catch (e) {
              console.error('[VideoPlayer] Error generating poster:', e);
            }
          };
          
          video.onerror = () => {
            console.error('[VideoPlayer] Error loading video for poster generation');
          };
          
          video.load();
        } catch (e) {
          console.error('[VideoPlayer] Error setting up poster generation:', e);
        }
      };
      
      generatePoster();
    }
  }, [src, poster, posterImage]);

  useEffect(() => {
    setError(null);
    setErrorDetails('');
    setIsLoading(true);
    
    if (!src) {
      console.log('[VideoPlayer] No source provided to VideoPlayer');
      setError('No video source provided');
      setIsLoading(false);
      if (onError) onError('No video source provided');
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
      if (onError) onError('Unsupported video format');
    }
  }, [src, onError]);

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
      
      let errorMessage = errorMsg;
      if (processedSrc.startsWith('blob:')) {
        errorMessage = `Cannot load blob video. The URL may have expired since your last refresh.`;
        details += 'Blob URLs are temporary and expire when the page is refreshed.\n';
      } else if (processedSrc.startsWith('data:')) {
        errorMessage = `Cannot load data URL video. The encoding may be incorrect.`;
        details += 'Data URLs might be too large or improperly encoded.\n';
      }
      
      setError(errorMessage);
      setErrorDetails(details);
      setIsLoading(false);
      
      if (onError) onError(errorMessage);
    };
    
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    video.pause();
    
    try {
      video.src = processedSrc;
      // If we have a poster image, set it on the video element
      if (posterImage) {
        video.poster = posterImage;
      }
      video.load();
      
      if (autoPlay) {
        video.play().catch(e => {
          console.warn('[VideoPlayer] Autoplay prevented:', e);
        });
      }
    } catch (err) {
      console.error('[VideoPlayer] Error setting up video:', err);
      const errorMessage = `Setup error: ${err}`;
      setError(errorMessage);
      setIsLoading(false);
      if (onError) onError(errorMessage);
    }
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      
      video.pause();
      video.src = '';
      video.load();
    };
  }, [processedSrc, autoPlay, onLoadedData, videoRef, onError, posterImage]);

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
      
      {error && !onError && (
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
      
      {/* If we have a poster image but video isn't loaded yet, show the poster as background */}
      {posterImage && isLoading && (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${posterImage})`,
            zIndex: -1 
          }}
        />
      )}
      
      <video
        ref={videoRef || internalVideoRef}
        className={cn("w-full h-full object-cover", className)}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        poster={posterImage || undefined}
      >
        <source src={src} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
