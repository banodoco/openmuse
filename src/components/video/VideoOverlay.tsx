
import React, { useEffect } from 'react';
import { Play } from 'lucide-react';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoOverlay');

interface VideoOverlayProps {
  isMobile: boolean;
  poster?: string;
  posterLoaded: boolean;
  showPlayButton?: boolean;
}

const VideoOverlay: React.FC<VideoOverlayProps> = ({
  isMobile,
  poster,
  posterLoaded,
  showPlayButton = true
}) => {
  useEffect(() => {
    logger.log(`VideoOverlay props: isMobile=${isMobile}, poster=${!!poster}, posterLoaded=${posterLoaded}`);
  }, [isMobile, poster, posterLoaded]);

  if (!isMobile || !poster || !showPlayButton) {
    return null;
  }

  // Always show overlay on mobile when poster exists, regardless of posterLoaded state
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
