
import React from 'react';
import { VideoEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VideoDetailsProps {
  video: VideoEntry;
}

const VideoDetails: React.FC<VideoDetailsProps> = ({ video }) => {
  // Helper function to get the best display name
  const getCreatorName = () => {
    // First try to use the metadata.creatorName
    if (video.metadata?.creatorName) {
      // If it's an email, only show the part before @
      if (video.metadata.creatorName.includes('@')) {
        return video.metadata.creatorName.split('@')[0];
      }
      return video.metadata.creatorName;
    }
    
    // Then try reviewer_name with the same email handling
    if (video.reviewer_name) {
      if (video.reviewer_name.includes('@')) {
        return video.reviewer_name.split('@')[0];
      }
      return video.reviewer_name;
    }
    
    return 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{video.metadata?.title || 'Video Details'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created by</h3>
          <p>{getCreatorName()}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoDetails;
