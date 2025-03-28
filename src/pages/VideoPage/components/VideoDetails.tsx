
import React from 'react';
import { VideoEntry } from '@/lib/types';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Approval Status</h3>
          <div className="mt-1">
            {video.admin_approved === "Curated" ? (
              <Badge variant="secondary" className="gap-1 bg-green-500 hover:bg-green-600 text-white">
                <Check className="h-3 w-3" />
                Curated
              </Badge>
            ) : video.admin_approved === "Rejected" ? (
              <Badge variant="destructive" className="gap-1">
                <X className="h-3 w-3" />
                Rejected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                Listed
              </Badge>
            )}
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created by</h3>
          <p>{video.metadata?.creatorName || video.reviewer_name}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoDetails;
