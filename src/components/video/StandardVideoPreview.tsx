import React, { useRef, useState, useEffect } from 'react';
import { Play, FileVideo, Eye, RefreshCw } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './VideoPreviewError';
import { cn } from '@/lib/utils';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { isValidVideoUrl } from '@/lib/utils/videoUtils';

const logger = new Logger('StandardVideoPreview');

interface StandardVideoPreviewProps {
  url: string | null;
  posterUrl: string | null;
  onError: (msg: string) => void;
  videoId?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isHovering?: boolean;
  expandOnHover?: boolean;
}

const StandardVideoPreview: React.FC<StandardVideoPreviewProps> = ({
  url,
  posterUrl,
  onError,
  videoId,
  onRefresh,
  isRefreshing = false,
  isHovering = false,
  expandOnHover = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastErrorTime, setLastErrorTime] = useState<number | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(url);
  const [isValidUrl, setIsValidUrl] = useState<boolean>(url ? isValidVideoUrl(url) : false);
  const [hover, setHover] = useState(isHovering);
  
  useEffect(() => {
    const prevHover = hover;
    setHover(isHovering);
    
    if (!prevHover && isHovering) {
      logger.log('StandardVideoPreview: External hover state changed to true');
    } else if (prevHover && !isHovering) {
      logger.log('StandardVideoPreview: External hover state changed to false');
    }
  }, [isHovering, hover]);
  
  const isBlobUrl = url?.startsWith('blob:') || false;
  
  useEffect(() => {
    if (!url) {
      setIsValidUrl(false);
      return;
    }
    
    if (isBlobUrl) {
      setIsValidUrl(true);
      return;
    }
    
    if (isValidVideoUrl(url)) {
      setIsValidUrl(true);
    } else {
      setIsValidUrl(false);
    }
  }, [url, isBlobUrl]);
  
  useEffect(() => {
    setCurrentUrl(url);
  }, [url]);
  
  const handleError = (msg: string) => {
    const now = Date.now();
    setLastErrorTime(now);
    setErrorCount(prev => prev + 1);
    setCurrentError(msg);
    
    logger.error(`Video preview error: ${msg}`);
    logger.error(`Video URL: ${currentUrl || 'none'}`);
    logger.error(`Error count: ${errorCount + 1}`);
    logger.error(`Time since last error: ${lastErrorTime ? now - lastErrorTime : 'first error'} ms`);
    
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
    
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleMouseEnter = () => {
    logger.log('StandardVideoPreview: Mouse entered - setting hover state to true');
    setHover(true);
  };

  const handleMouseLeave = () => {
    logger.log('StandardVideoPreview: Mouse left - setting hover state to false');
    setHover(false);
  };

  if (!isValidUrl || !currentUrl) {
    return null;
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {currentError ? (
        <VideoPreviewError
          error={currentError}
          details={errorDetails || undefined}
          onRetry={handleRetry}
          videoSource={currentUrl}
        />
      ) : (
        <VideoPlayer 
          src={currentUrl} 
          controls={false}
          autoPlay={false}
          muted={true}
          className="w-full h-full object-cover transition-all duration-300"
          onError={handleError}
          poster={posterUrl || undefined}
          playOnHover={true}
          containerRef={containerRef}
          showPlayButtonOnHover={false}
          isHovering={hover}
          expandOnHover={expandOnHover}
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
      
      {onRefresh && currentError && (
        <div className="absolute top-2 right-2 z-10">
          <Button 
            size="sm" 
            variant="secondary" 
            className="gap-1 opacity-90 hover:opacity-100"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh URL"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default StandardVideoPreview;
