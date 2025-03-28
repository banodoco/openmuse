
import React from 'react';
import { VideoEntry } from '@/lib/types';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VideoDetailsProps {
  video: VideoEntry;
}

const VideoDetails: React.FC<VideoDetailsProps> = ({ video }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Information</CardTitle>
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
          <h3 className="text-sm font-medium text-muted-foreground">Creator</h3>
          <p>{video.metadata?.creatorName || video.reviewer_name}</p>
        </div>
        
        {video.metadata?.description && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
            <p>{video.metadata.description}</p>
          </div>
        )}
        
        {video.metadata?.classification && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Classification</h3>
            <p className="capitalize">{video.metadata.classification}</p>
          </div>
        )}
        
        {video.metadata?.model && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Model</h3>
            <p className="uppercase">{video.metadata.model}</p>
          </div>
        )}
        
        {video.metadata?.loraName && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">LoRA Name</h3>
            <p>{video.metadata.loraName}</p>
          </div>
        )}
        
        {video.metadata?.loraDescription && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">LoRA Description</h3>
            <p>{video.metadata.loraDescription}</p>
          </div>
        )}
        
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
          <p>{formatDate(video.created_at)}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoDetails;
