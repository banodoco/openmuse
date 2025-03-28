
import React, { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Play } from 'lucide-react';
import StorageVideoPlayer from '../StorageVideoPlayer';
import { VideoEntry } from '@/lib/types';

interface VideoCardProps {
  video: VideoEntry;
  isAdmin: boolean;
  onOpenLightbox: (video: VideoEntry) => void;
  onApproveVideo?: (videoId: string) => void;
  onDeleteVideo?: (videoId: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = memo(({
  video,
  isAdmin,
  onOpenLightbox,
  onApproveVideo,
  onDeleteVideo
}) => {
  const [isHovering, setIsHovering] = useState(false);
  
  return (
    <div 
      key={video.id} 
      className="relative rounded-lg overflow-hidden shadow-md group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => onOpenLightbox(video)}
    >
      <div className="aspect-video">
        <div className="w-full h-full">
          <div className="w-full h-full relative">
            <StorageVideoPlayer
              key={`video-${video.id}`}
              videoLocation={video.video_location}
              controls={false}
              muted={true}
              className="w-full h-full object-cover"
              playOnHover={false}
              previewMode={true}
              showPlayButtonOnHover={false}
              autoPlay={isHovering}
              isHoveringExternally={isHovering}
            />
            
            <div 
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 
                ${isHovering 
                  ? 'opacity-100' 
                  : 'opacity-0'
                }`}
            >
              <div className="bg-white/10 rounded-full p-2 backdrop-blur-sm">
                <Play className="h-6 w-6 text-white/50 group-hover:text-white/70 transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-2 bg-card">
        <h3 className="font-medium text-sm truncate">
          {video.metadata?.title || `Video by ${video.reviewer_name}`}
        </h3>
        {video.reviewer_name && (
          <p className="text-xs text-muted-foreground">By {video.reviewer_name}</p>
        )}
      </div>
      
      {isAdmin && (
        <div className="absolute top-2 right-2 flex space-x-1 z-10">
          <Button 
            variant="secondary" 
            size="icon" 
            className="h-6 w-6 bg-black/40 hover:bg-black/60 text-white"
            onClick={(e) => {
              e.stopPropagation();
              if (onApproveVideo) onApproveVideo(video.id);
            }}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button 
            variant="destructive" 
            size="icon" 
            className="h-6 w-6 text-white"
            onClick={(e) => {
              e.stopPropagation();
              if (onDeleteVideo) onDeleteVideo(video.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
});

VideoCard.displayName = 'VideoCard';

export default VideoCard;
