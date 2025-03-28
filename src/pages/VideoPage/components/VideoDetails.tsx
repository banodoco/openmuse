
import React from 'react';
import { VideoEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VideoDetailsProps {
  video: VideoEntry;
}

const VideoDetails: React.FC<VideoDetailsProps> = ({ video }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{video.metadata?.title || 'Video Details'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created by</h3>
          <p>{video.metadata?.creatorName || video.reviewer_name}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoDetails;
