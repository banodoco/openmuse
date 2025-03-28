
import React from 'react';
import { VideoEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileVideo, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import StorageVideoPlayer from '@/components/StorageVideoPlayer';
import { isValidVideoUrl } from '@/lib/utils/videoUtils';

interface VideoPlayerCardProps {
  video: VideoEntry;
  videoUrl: string | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

const VideoPlayerCard: React.FC<VideoPlayerCardProps> = ({ 
  video, 
  videoUrl, 
  onRefresh,
  isRefreshing 
}) => {
  const hasValidVideo = (videoUrl && isValidVideoUrl(videoUrl)) || 
    (video.video_location && isValidVideoUrl(video.video_location));
  
  const isBlobUrl = video.video_location?.startsWith('blob:');
  const showBlobWarning = isBlobUrl && !videoUrl;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{video.metadata?.title || video.reviewer_name}</CardTitle>
        
        {showBlobWarning && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh URL'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {showBlobWarning && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Temporary URL Expired</AlertTitle>
            <AlertDescription>
              The temporary video URL has expired. Click the refresh button to retrieve a permanent URL.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="aspect-video w-full rounded-md overflow-hidden">
          {hasValidVideo ? (
            videoUrl ? (
              <StorageVideoPlayer 
                videoLocation={videoUrl} 
                controls
                muted={false}
              />
            ) : (
              <StorageVideoPlayer 
                videoLocation={video.video_location} 
                controls
                muted={false}
              />
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
              <FileVideo className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Video unavailable</p>
              <p className="text-xs text-muted-foreground mt-2">The video source is invalid or has expired</p>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRefresh}
                disabled={isRefreshing}
                className="gap-1 mt-4"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Try Refreshing URL'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoPlayerCard;
