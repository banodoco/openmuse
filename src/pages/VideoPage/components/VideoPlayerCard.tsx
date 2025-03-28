
import React from 'react';
import { VideoEntry } from '@/lib/types';
import { FileVideo, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VideoPlayer from '@/components/video/VideoPlayer';
import { isValidVideoUrl } from '@/lib/utils/videoUtils';

interface VideoPlayerCardProps {
  video: VideoEntry;
  videoError: string | null;
  onVideoLoaded: () => void;
  onVideoError: () => void;
}

const VideoPlayerCard: React.FC<VideoPlayerCardProps> = ({ 
  video, 
  videoError, 
  onVideoLoaded, 
  onVideoError 
}) => {
  const hasValidVideo = video.video_location && isValidVideoUrl(video.video_location);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{video.metadata?.title || video.reviewer_name}</CardTitle>
      </CardHeader>
      <CardContent>
        {videoError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {videoError}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="aspect-video w-full bg-muted rounded-md overflow-hidden">
          {hasValidVideo ? (
            <VideoPlayer 
              src={video.video_location} 
              controls
              onLoadedData={onVideoLoaded}
              onError={onVideoError}
              muted={false}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <FileVideo className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Video unavailable</p>
              <p className="text-xs text-muted-foreground mt-2">The video source is invalid or has expired</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoPlayerCard;
