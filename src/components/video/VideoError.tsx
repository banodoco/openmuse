import React from 'react';
import { Logger } from '@/lib/logger';
import { AlertCircle, RefreshCw, AlertTriangle, ExternalLink, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getVideoFormat } from '@/lib/utils/videoUtils';

const logger = new Logger('VideoError');

interface VideoErrorProps {
  error: string;
  errorDetails?: string;
  onRetry: () => void;
  videoSource?: string;
}

const VideoError: React.FC<VideoErrorProps> = ({ 
  error, 
  errorDetails, 
  onRetry,
  videoSource
}) => {
  logger.error(`[VideoMobileError] Displaying video error: ${error}`, { videoSource });
  if (errorDetails) {
    logger.error(`[VideoMobileError] Error details: ${errorDetails}`, { videoSource });
  } else {
    logger.warn(`[VideoMobileError] No errorDetails provided for error: ${error}`, { videoSource });
  }
  
  // Log URL for debugging
  if (videoSource) {
    logger.error(`Problem video source: ${videoSource}`);
  }

  // Determine if this is likely a format issue
  const isFormatError = error.includes('format') || error.includes('not supported');
  const isBlobError = videoSource?.startsWith('blob:') && error.includes('Invalid video source');
  const detectedFormat = videoSource ? getVideoFormat(videoSource) : 'Unknown';

  let displayTitle = "Video Playback Error"; // Default title
  const lowerError = error.toLowerCase();

  if (isBlobError) {
    displayTitle = "Preview Unavailable";
  } else if (isFormatError) {
    displayTitle = "Format Unsupported";
  } else if (lowerError.includes("network")) {
    displayTitle = "Network Issue";
  } else if (lowerError.includes("decode") || lowerError.includes("corruption")) {
    displayTitle = "Playback Issue";
  } else if (lowerError === "the operation was aborted." || lowerError.includes("aborted")) {
    displayTitle = "Playback Aborted";
  } else if (lowerError.includes("source") || lowerError.includes("invalid url") || lowerError.includes("cannot be played")) {
    displayTitle = "Video Source Issue";
  } else if (lowerError.includes("hls")) {
    displayTitle = "Streaming Error";
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
      <div className="text-destructive text-center p-4 bg-white/95 rounded-lg shadow-lg max-w-[90%]">
        {isBlobError ? (
          <Database className="h-6 w-6 mx-auto text-amber-500 mb-2" />
        ) : isFormatError ? (
          <AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
        ) : (
          <AlertCircle className="h-6 w-6 mx-auto text-destructive mb-2" />
        )}
        
        <p className="font-medium">{displayTitle}</p>
        <p className="text-xs text-muted-foreground mt-1 mb-2 break-words">{error}</p>
        
        {isBlobError && (
          <div className="mb-3 text-xs bg-amber-50 p-2 rounded-md text-amber-800">
            <p>The temporary video URL has expired.</p>
            <p className="mt-1">Please try refreshing or reopening this page.</p>
          </div>
        )}
        
        {isFormatError && !isBlobError && (
          <div className="mb-3 text-xs bg-amber-50 p-2 rounded-md text-amber-800">
            <p>Your browser doesn't support {detectedFormat} video format.</p>
            <p className="mt-1">Try using Chrome or Firefox for best compatibility.</p>
          </div>
        )}
        
        {errorDetails && (
          <details className="text-left mb-3">
            <summary className="text-xs text-muted-foreground cursor-pointer">View technical details</summary>
            <p className="text-xs text-muted-foreground p-2 bg-muted rounded overflow-auto max-h-[60px] mt-1">
              {errorDetails}
            </p>
          </details>
        )}
        
        <div className="flex gap-2 justify-center mt-2">
          <Button 
            size="sm"
            variant="default"
            className="gap-1"
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3" />
            Try again
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

export default VideoError;
