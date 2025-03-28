
import React from 'react';
import { VideoEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileVideo, RefreshCw } from 'lucide-react';
import VideoPlayer from '@/components/video/VideoPlayer';

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
  const hasVideoUrl = Boolean(videoUrl);
  
  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    onRefresh();
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{video.metadata?.title || video.reviewer_name || 'Untitled Video'}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasVideoUrl && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Video preview unavailable</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>The temporary URL has expired</span>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-28 gap-2"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="aspect-video w-full bg-muted rounded-md overflow-hidden">
          {hasVideoUrl ? (
            <VideoPlayer 
              src={videoUrl!} 
              controls
              muted={false}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <FileVideo className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Video unavailable</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoPlayerCard;
