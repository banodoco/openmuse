
import React from 'react';
import { AlertCircle, RefreshCw, ExternalLink, AlertTriangle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logger } from '@/lib/logger';
import { getVideoFormat } from '@/lib/utils/videoUtils';

const logger = new Logger('VideoPreviewError');

interface VideoPreviewErrorProps {
  error: string;
  onRetry: () => void;
  details?: string;
  videoSource?: string;
}

const VideoPreviewError: React.FC<VideoPreviewErrorProps> = ({ 
  error, 
  onRetry, 
  details,
  videoSource
}) => {
  // Log the error for debugging
  logger.error(`Video preview error: ${error}`);
  if (details) {
    logger.error(`Error details: ${details}`);
  }
  if (videoSource) {
    logger.error(`Problem video source: ${videoSource}`);
  }

  // Determine if this is likely a format issue or a blob URL issue
  const isFormatError = error.includes('format') || error.includes('not supported');
  const isBlobError = videoSource?.startsWith('blob:') && error.includes('Invalid video source');
  const detectedFormat = videoSource ? getVideoFormat(videoSource) : 'Unknown';

  const handlePageRefresh = () => {
    logger.log('Refreshing entire page...');
    window.location.reload();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-background p-4 rounded-lg max-w-[90%] text-center">
        {isBlobError ? (
          <Database className="h-6 w-6 text-amber-500 mx-auto mb-2" />
        ) : isFormatError ? (
          <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
        ) : (
          <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
        )}
        
        <h4 className="font-medium text-sm mb-1">Error loading video</h4>
        <p className="text-xs text-muted-foreground mb-2">{error}</p>
        
        {isBlobError && (
          <div className="mb-3 text-xs bg-amber-50 p-2 rounded-md text-amber-800">
            <p>The temporary video URL has expired.</p>
            <p className="mt-1">Please try refreshing this page.</p>
          </div>
        )}
        
        {isFormatError && !isBlobError && (
          <div className="mb-3 text-xs bg-amber-50 p-2 rounded-md text-amber-800">
            <p>Your browser doesn't support {detectedFormat} video format.</p>
            <p className="mt-1">Try using Chrome or Firefox for best compatibility.</p>
          </div>
        )}
        
        {details && (
          <div className="mb-3">
            <details className="text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer">View technical details</summary>
              <p className="text-xs text-muted-foreground p-2 bg-muted rounded overflow-auto max-h-[60px] mt-1">
                {details}
              </p>
            </details>
          </div>
        )}
        
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={onRetry} variant="default" className="gap-1">
            <RefreshCw className="h-3 w-3" /> Try again
          </Button>
          
          <Button size="sm" onClick={handlePageRefresh} variant="outline">
            Refresh page
          </Button>
          
          {videoSource && videoSource.startsWith('http') && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => window.open(videoSource, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              Open directly
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPreviewError;
