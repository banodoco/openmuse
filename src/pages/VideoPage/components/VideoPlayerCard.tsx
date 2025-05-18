import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileVideo, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VideoEntry } from '@/lib/types';
import VideoPlayer from '@/components/video/VideoPlayer';
import StorageVideoPlayer from '@/components/StorageVideoPlayer';

interface VideoPlayerCardProps {
  video: VideoEntry | null;
  videoUrl: string | null;
  posterUrl?: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const VideoPlayerCard: React.FC<VideoPlayerCardProps> = ({ 
  video, 
  videoUrl, 
  posterUrl,
  onRefresh,
  isRefreshing
}) => {
  const [videoError, setVideoError] = useState<string | null>(null);
  
  const handleVideoError = (error: string) => {
    console.error('Video player error:', error);
    setVideoError(error);
  };
  
  const handleVideoLoaded = () => {
    setVideoError(null);
  };
  
  const isTemporaryUrl = videoUrl?.startsWith('blob:');
  const isPermanentUrl = videoUrl?.startsWith('http') && !isTemporaryUrl;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{video?.metadata?.title || 'Video'}</CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
          {isRefreshing ? "Refreshing..." : "Refresh URL"}
        </Button>
      </CardHeader>
      <CardContent>
        {videoError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Video Error</AlertTitle>
            <AlertDescription>
              {videoError}
              {isTemporaryUrl && (
                <div className="mt-2">
                  <p className="text-sm">This video is using a temporary URL which may have expired.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshing && "animate-spin")} />
                    {isRefreshing ? "Refreshing..." : "Refresh URL"}
                  </Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="aspect-video w-full bg-muted rounded-md overflow-hidden">
          {videoUrl ? (
            <VideoPlayer 
              src={videoUrl} 
              poster={posterUrl || undefined}
              controls
              onLoadedData={handleVideoLoaded}
              onError={handleVideoError}
              muted={false}
            />
          ) : video?.id ? (
            // If we have a video ID but no URL, let StorageVideoPlayer try to resolve from database
            <StorageVideoPlayer videoLocation={video.id} controls />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <FileVideo className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Video unavailable</p>
              <p className="text-xs text-muted-foreground mt-2">The video source is invalid or has expired</p>
            </div>
          )}
        </div>
        
        {isTemporaryUrl && !videoError && (
          <Alert variant="default" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Temporary URL</AlertTitle>
            <AlertDescription>
              This video is using a temporary URL which may expire. If the video stops working, click the refresh button.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoPlayerCard;
