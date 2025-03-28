
import React from 'react';
import { VideoEntry } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import StorageVideoPlayer from '@/components/StorageVideoPlayer';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface VideoPlayerCardProps {
  video: VideoEntry;
  videoUrl: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const VideoPlayerCard: React.FC<VideoPlayerCardProps> = ({ 
  video, 
  videoUrl, 
  onRefresh,
  isRefreshing 
}) => {
  // Use the provided videoUrl if available, otherwise fall back to video_location
  const videoSource = videoUrl || video.video_location;
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0 relative">
        <div className="aspect-video w-full">
          <StorageVideoPlayer 
            videoLocation={videoSource}
            controls={true}
            autoPlay={false}
            muted={false}
            loop={false}
            className="w-full h-full"
          />
        </div>
        
        {/* Add refresh button */}
        <Button 
          variant="secondary" 
          size="sm" 
          className="absolute top-2 right-2 gap-1 opacity-90 hover:opacity-100"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Video'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default VideoPlayerCard;
