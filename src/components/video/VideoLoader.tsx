
import React from 'react';

interface VideoLoaderProps {
  posterImage?: string | null;
  fullScreen?: boolean;
}

const VideoLoader: React.FC<VideoLoaderProps> = ({ posterImage, fullScreen = false }) => {
  // If we have a poster image, we'll make the loader more subtle
  // and let the poster image be the main visual
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${posterImage ? 'bg-black/10' : 'bg-black/30'}`}>
      {posterImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${posterImage})`,
            zIndex: -1 
          }}
        />
      )}
      
      <div className={`${posterImage ? 'bg-black/30' : ''} rounded-full p-2 flex items-center justify-center ${fullScreen ? 'w-12 h-12' : 'w-8 h-8'}`}>
        <div className={`animate-spin border-4 border-primary border-t-transparent rounded-full ${fullScreen ? 'w-8 h-8' : 'w-5 h-5'}`} />
      </div>
    </div>
  );
};

export default VideoLoader;
