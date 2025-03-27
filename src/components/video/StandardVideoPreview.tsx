
import React, { useRef, useState } from 'react';
import { Play, FileVideo, Eye } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './VideoPreviewError';

const logger = new Logger('StandardVideoPreview');

interface StandardVideoPreviewProps {
  url: string | null;
  posterUrl: string | null;
  onError: (msg: string) => void;
  videoId?: string;
  onRefresh?: (e: React.MouseEvent) => void;
  isRefreshing?: boolean;
}

const StandardVideoPreview: React.FC<StandardVideoPreviewProps> = ({
  url,
  posterUrl,
  onError,
  videoId,
  onRefresh,
  isRefreshing = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastErrorTime, setLastErrorTime] = useState<number | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  
  const handleError = (msg: string) => {
    const now = Date.now();
    setLastErrorTime(now);
    setErrorCount(prev => prev + 1);
    setCurrentError(msg);
    
    logger.error(`Video preview error: ${msg}`);
    logger.error(`Video URL: ${url}`);
    logger.error(`Error count: ${errorCount + 1}`);
    logger.error(`Time since last error: ${lastErrorTime ? now - lastErrorTime : 'first error'} ms`);
    
    // Extract any potential details from the error message
    if (msg.includes(':')) {
      const parts = msg.split(':');
      setErrorDetails(parts.slice(1).join(':').trim());
    }
    
    onError(msg);
  };
  
  const handleRetry = () => {
    logger.log('Retry clicked in error component');
    setErrorCount(0);
    setCurrentError(null);
    setErrorDetails(null);
  };
  
  if (!url) {
    return (
      <div 
        className="flex flex-col items-center justify-center w-full h-full bg-muted/70 cursor-pointer relative"
        style={posterUrl ? {
          backgroundImage: `url(${posterUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {}}
      >
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
          <Play className="h-6 w-6 text-white" />
        </div>
        <div className="mt-2 text-xs text-muted-foreground flex items-center bg-black/50 px-2 py-1 rounded">
          <FileVideo className="h-3 w-3 mr-1" />
          Preview
        </div>
        
        {videoId && (
          <div className="absolute bottom-2 right-2">
            <Link to={`/videos/${videoId}`}>
              <Button size="sm" variant="secondary" className="gap-1 opacity-90 hover:opacity-100">
                <Eye className="h-3 w-3" />
                View
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {currentError ? (
        <VideoPreviewError
          error={currentError}
          details={errorDetails || undefined}
          onRetry={handleRetry}
          videoSource={url}
        />
      ) : (
        <VideoPlayer 
          src={url} 
          controls={false}
          autoPlay={false}
          muted={true}
          className="w-full h-full object-cover"
          onError={handleError}
          poster={posterUrl || undefined}
          playOnHover={true}
          containerRef={containerRef}
        />
      )}
      
      {videoId && (
        <div className="absolute bottom-2 right-2 z-10">
          <Link to={`/videos/${videoId}`}>
            <Button size="sm" variant="secondary" className="gap-1 opacity-90 hover:opacity-100">
              <Eye className="h-3 w-3" />
              View
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default StandardVideoPreview;
