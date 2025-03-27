
import React from 'react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AlertCircle, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  logger.error(`Displaying video error: ${error}`);
  if (errorDetails) {
    logger.error(`Error details: ${errorDetails}`);
  }
  
  // Log URL safety check errors specifically
  if (error.includes('URL safety check') || (errorDetails && errorDetails.includes('URL safety check'))) {
    logger.error('URL safety check error detected. This may be due to cross-origin restrictions.');
    if (videoSource) {
      logger.error(`Problem video source: ${videoSource}`);
    }
  }
  
  const handleShowErrorDetails = () => {
    toast.info(errorDetails || 'No additional error details available');
  };

  const handleRetry = () => {
    logger.log('Retry button clicked');
    onRetry();
  };

  // Customize error message for specific error types
  const getActionText = () => {
    if (error.includes('URL safety check') || (errorDetails && errorDetails.includes('URL safety check'))) {
      return 'This is likely due to browser security restrictions. Please try loading the permanent URL.';
    }
    if (error.includes('blob') || (errorDetails && errorDetails.includes('blob'))) {
      return 'The temporary video link has expired. Please try retrieving the permanent URL from the database.';
    }
    return '';
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
      <div className="text-destructive text-center p-4 bg-white/95 rounded-lg shadow-lg max-w-[90%]">
        <AlertCircle className="h-6 w-6 mx-auto text-destructive mb-2" />
        <p className="font-medium">Error loading video</p>
        <p className="text-xs text-muted-foreground mt-1 mb-2 break-words">{error}</p>
        
        {getActionText() && (
          <p className="text-xs text-amber-600 mt-1 mb-3 break-words">{getActionText()}</p>
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
            onClick={handleRetry}
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </Button>
          
          {errorDetails && (
            <Button 
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={handleShowErrorDetails}
            >
              <Info className="h-3 w-3" />
              More info
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoError;
