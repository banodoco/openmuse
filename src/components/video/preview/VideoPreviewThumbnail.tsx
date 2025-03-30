
import React from 'react';

interface VideoPreviewThumbnailProps {
  posterUrl: string | null;
  effectiveHoverState: boolean;
  showPlayButton: boolean;
  isMobile?: boolean;
}

const VideoPreviewThumbnail: React.FC<VideoPreviewThumbnailProps> = ({
  posterUrl,
  effectiveHoverState,
  showPlayButton,
  isMobile = false
}) => {
  if (!posterUrl || posterUrl === '/placeholder.svg') {
    return null;
  }

  return (
    <>
      {/* Play button overlay */}
      {showPlayButton && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`w-12 h-12 rounded-full bg-black/50 flex items-center justify-center transition-opacity ${effectiveHoverState && !isMobile ? 'opacity-0' : 'opacity-80'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoPreviewThumbnail;
