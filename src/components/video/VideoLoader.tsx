
import React from 'react';

interface VideoLoaderProps {
  posterImage?: string | null;
}

const VideoLoader: React.FC<VideoLoaderProps> = ({ posterImage }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
      {posterImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${posterImage})`,
            zIndex: -1 
          }}
        />
      )}
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
};

export default VideoLoader;
