
import React, { useRef, useState } from 'react';
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
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5">
          <div className="text-destructive text-center p-4">
            <p>Error loading video</p>
            <button 
              className="mt-2 text-sm underline"
              onClick={() => setError(false)}
            >
              Try again
            </button>
          </div>
        </div>
      )}
      
      <video
        className={cn("w-full h-full object-cover", className)}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        onError={() => setError(true)}
        onLoadedData={onLoadedData}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;
