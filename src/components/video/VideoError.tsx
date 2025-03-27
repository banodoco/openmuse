
import React from 'react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoError');

interface VideoErrorProps {
  error: string;
  errorDetails?: string;
  onRetry: () => void;
}

const VideoError: React.FC<VideoErrorProps> = ({ 
  error, 
  errorDetails, 
  onRetry 
}) => {
  logger.error(`Displaying video error: ${error}`);
  if (errorDetails) {
    logger.error(`Error details: ${errorDetails}`);
  }
  
  const handleShowErrorDetails = () => {
    toast.info(errorDetails || 'No additional error details available');
  };

  const handleRetry = () => {
    logger.log('Retry button clicked');
    onRetry();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
      <div className="text-destructive text-center p-4 bg-white/90 rounded-lg shadow-lg max-w-[80%]">
        <p className="font-medium">Error loading video</p>
        <p className="text-xs text-muted-foreground mt-1 mb-2 break-words">{error}</p>
        <div className="flex gap-2 justify-center mt-2">
          <button 
            className="text-sm font-medium bg-primary text-white px-3 py-1 rounded-md"
            onClick={handleRetry}
          >
            Try again
          </button>
          {errorDetails && (
            <button 
              className="text-sm font-medium bg-secondary text-primary px-3 py-1 rounded-md"
              onClick={handleShowErrorDetails}
            >
              More info
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoError;
