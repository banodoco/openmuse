
import React, { useEffect } from 'react';
import { VideoEntry } from '@/lib/types';
import VideoPlayer from '@/components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { SkipForward, VideoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoViewerProps {
  video: VideoEntry;
  onSkip: () => void;
  onStartRecording: () => void;
  onVideoLoaded: () => void;
}

const VideoViewer: React.FC<VideoViewerProps> = ({
  video,
  onSkip,
  onStartRecording,
  onVideoLoaded
}) => {
  useEffect(() => {
    console.log("VideoViewer: Rendering with video:", {
      id: video.id,
      video_location: video.video_location.substring(0, 50) + '...',
      reviewer_name: video.reviewer_name
    });
  }, [video]);

  return (
    <div className="animate-slide-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <span className="text-sm font-medium text-muted-foreground">
            Uploaded by {video.reviewer_name}
          </span>
          <h2 className="text-2xl font-bold">Watch and Respond</h2>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={onSkip}
            className="gap-2 rounded-full"
          >
            <SkipForward className="h-4 w-4" />
            Skip This Video
          </Button>
          <Button 
            onClick={onStartRecording}
            className={cn(
              "gap-2 rounded-full transition-all duration-300",
              "hover:bg-primary/90 hover:scale-[1.02]"
            )}
          >
            <VideoIcon className="h-4 w-4" />
            Record Response
          </Button>
        </div>
      </div>
      
      <div className="bg-card shadow-subtle rounded-xl overflow-hidden p-6">
        <div className="aspect-video w-full max-h-[70vh] rounded-lg overflow-hidden">
          <VideoPlayer 
            src={video.video_location} 
            controls
            autoPlay
            onLoadedData={onVideoLoaded}
            muted={false}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoViewer;
