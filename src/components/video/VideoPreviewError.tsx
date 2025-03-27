
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPreviewErrorProps {
  error: string;
  onRetry: () => void;
  details?: string;
}

const VideoPreviewError: React.FC<VideoPreviewErrorProps> = ({ error, onRetry, details }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-background p-4 rounded-lg max-w-[90%] text-center">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
        <h4 className="font-medium text-sm mb-1">Error loading video</h4>
        <p className="text-xs text-muted-foreground mb-2">{error}</p>
        {details && (
          <p className="text-xs text-muted-foreground mb-3 text-left p-2 bg-muted rounded overflow-auto max-h-[60px]">
            {details}
          </p>
        )}
        <Button size="sm" onClick={onRetry} className="mt-1">Try again</Button>
      </div>
    </div>
  );
};

export default VideoPreviewError;
