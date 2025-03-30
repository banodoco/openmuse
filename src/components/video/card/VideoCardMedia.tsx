
import React from 'react';
import { Play } from 'lucide-react';
import VideoPreview from '../../VideoPreview';
import { Logger } from '@/lib/logger';
import { VideoEntry } from '@/lib/types';

const logger = new Logger('VideoCardMedia');

interface VideoCardMediaProps {
  video: VideoEntry;
  isHovering: boolean;
  thumbnailUrl: string | null;
  creatorName: string;
  onTouch: () => void;
  isMobile: boolean;
  showPlayButton: boolean;
  forceFrameCapture: boolean;
  captureTimeout: number;
}

const VideoCardMedia: React.FC<VideoCardMediaProps> = ({
  video,
  isHovering,
  thumbnailUrl,
  creatorName,
  onTouch,
  isMobile,
  showPlayButton,
  forceFrameCapture,
  captureTimeout
}) => {
  return (
    <div className="aspect-video">
      <div className="w-full h-full">
        <VideoPreview
          key={`video-${video.id}`}
          url={video.video_location}
          title={video.metadata?.title || `Video by ${creatorName}`}
          creator={creatorName}
          className="w-full h-full object-cover"
          isHovering={isHovering && !isMobile} // Don't consider hovering on mobile
          lazyLoad={false}
          thumbnailUrl={thumbnailUrl}
          onTouch={onTouch}
          isMobile={isMobile}
          showPlayButton={showPlayButton}
          forceFrameCapture={forceFrameCapture}
          captureTimeout={captureTimeout}
          fallbackToVideo={true}
        />
        
        {/* Always show play button on mobile */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none
            ${(isHovering && !isMobile) ? 'opacity-0' : 'opacity-100'}
          `}
        >
          <div className="bg-black/30 rounded-full p-3 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCardMedia;
