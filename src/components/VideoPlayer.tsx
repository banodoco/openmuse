
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
  const [isLoading, setIsLoading] = useState(true);

  // Function to check if a string is a blob URL
  const isBlobUrl = (url: string): boolean => {
    return url.startsWith('blob:');
  };

  useEffect(() => {
    if (!videoRef.current || !src) return;
    
    const video = videoRef.current;
    
    // Reset error state when changing sources
    setError(null);
    setIsLoading(true);
    
    // Simplified event handlers
    const handleLoadedData = () => {
      console.log(`Video loaded successfully: ${src.substring(0, 30)}...`);
      setIsLoading(false);
      if (onLoadedData) onLoadedData();
    };
    
    const handleError = () => {
      const errorMsg = video.error 
        ? `Error ${video.error.code}: ${video.error.message}` 
        : 'Unknown video error';
      
      console.error(`Video error for ${src.substring(0, 30)}...: ${errorMsg}`);
      
      // Special handling for blob URLs
      if (isBlobUrl(src)) {
        setError(`Blob URL is no longer valid. The video may have expired or is not accessible in this context.`);
      } else {
        setError(errorMsg);
      }
      setIsLoading(false);
    };
    
    // Simple direct approach
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    // Stop any current playback
    video.pause();
    
    // Try to load the new video
    try {
      // For blob URLs, we need special handling
      if (isBlobUrl(src)) {
        // Fetch the blob directly to validate it exists
        fetch(src)
          .then(response => {
            if (!response.ok) throw new Error('Blob not accessible');
            return response.blob();
          })
          .then(blob => {
            // Create a new object URL from this blob to ensure it's valid in this context
            const validBlobUrl = URL.createObjectURL(blob);
            video.src = validBlobUrl;
            video.load();
            if (autoPlay) video.play().catch(e => console.warn('Autoplay prevented:', e));
          })
          .catch(err => {
            console.error('Error fetching blob:', err);
            setError('Could not access video blob. It may have expired.');
            setIsLoading(false);
          });
      } else {
        // Regular URL handling
        video.src = src;
        video.load();
        if (autoPlay) video.play().catch(e => console.warn('Autoplay prevented:', e));
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
      
      // If we created a blob URL, we should revoke it
      if (video.src && video.src !== src && isBlobUrl(video.src)) {
        URL.revokeObjectURL(video.src);
      }
    };
  }, [src, autoPlay, onLoadedData]);

  const handleRetry = () => {
    if (!videoRef.current) return;
    
    setError(null);
    setIsLoading(true);
    
    const video = videoRef.current;
    video.pause();
    
    // For blob URLs, we'll try to fetch it again
    if (isBlobUrl(src)) {
      fetch(src)
        .then(response => {
          if (!response.ok) throw new Error('Blob not accessible');
          return response.blob();
        })
        .then(blob => {
          const validBlobUrl = URL.createObjectURL(blob);
          video.src = validBlobUrl;
          video.load();
          if (autoPlay) video.play().catch(e => console.warn('Autoplay prevented:', e));
        })
        .catch(err => {
          console.error('Error fetching blob on retry:', err);
          setError('Could not access video blob. It may have expired.');
          setIsLoading(false);
        });
    } else {
      // For regular URLs
      video.src = src;
      video.load();
      if (autoPlay) video.play().catch(e => console.warn('Autoplay prevented:', e));
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
