
import React, { useEffect } from 'react';
import { Play } from 'lucide-react';
import { Logger } from '@/lib/logger';
import { useLocation } from 'react-router-dom';

const logger = new Logger('VideoOverlay');

interface VideoOverlayProps {
  isMobile: boolean;
  poster?: string;
  posterLoaded: boolean;
}

const VideoOverlay: React.FC<VideoOverlayProps> = ({
  isMobile,
  poster,
  posterLoaded
}) => {
  const location = useLocation();
  const isHomepage = location.pathname === "/" || location.pathname === "/index";
  
  useEffect(() => {
    logger.log(`VideoOverlay props: isMobile=${isMobile}, poster=${!!poster}, posterLoaded=${posterLoaded}, isHomepage=${isHomepage}`);
  }, [isMobile, poster, posterLoaded, isHomepage]);

  if (!isMobile || !poster) {
    return null;
  }

  // On homepage and mobile, show poster but no play button
  if (isHomepage) {
    return (
      <div 
        className="absolute inset-0 bg-cover bg-center z-10" 
        style={{ backgroundImage: `url(${poster})` }} 
      />
    );
  }

  // On other pages with mobile and poster, show both poster and play button
  return (
    <>
      <div 
        className="absolute inset-0 bg-cover bg-center z-10" 
        style={{ backgroundImage: `url(${poster})` }} 
      />
      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        <div className="bg-black/30 rounded-full p-3 backdrop-blur-sm">
          <Play className="h-6 w-6 text-white" />
        </div>
      </div>
    </>
  );
};

export default VideoOverlay;
