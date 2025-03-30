
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
  isMobile?: boolean;
  showPlayButtonOnMobile?: boolean;
}

const StandardVideoPreview: React.FC<StandardVideoPreviewProps> = ({
  url,
  posterUrl,
  onError,
  videoId,
  onRefresh,
  isRefreshing = false,
  isHovering = false,
  isMobile = false,
  showPlayButtonOnMobile = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastErrorTime, setLastErrorTime] = useState<number | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(url);
  const [isValidUrl, setIsValidUrl] = useState<boolean>(url ? isValidVideoUrl(url) : false);
  const [videoReady, setVideoReady] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  
  // Special case for blob URLs - they're always considered valid for preview
  const isBlobUrl = url?.startsWith('blob:') || false;
  
  // Handle poster image loading
  useEffect(() => {
    if (posterUrl) {
      const img = new Image();
      img.onload = () => {
        setPosterLoaded(true);
        logger.log('Poster image loaded successfully');
      };
      img.onerror = () => {
        logger.error('Failed to load poster image:', posterUrl);
        setPosterLoaded(false);
      };
      img.src = posterUrl;
    }
  }, [posterUrl]);
  
  // Check URL validity on mount and when URL changes
  useEffect(() => {
    // If there's no URL, don't even try to show anything
    if (!url) {
      setIsValidUrl(false);
      return;
    }
    
    // For blob URLs, always consider them valid for preview purposes
    if (isBlobUrl) {
      setIsValidUrl(true);
      return;
    }
    
    // For other URLs, check if they're valid video URLs
    if (isValidVideoUrl(url)) {
      setIsValidUrl(true);
    } else {
      setIsValidUrl(false);
    }
  }, [url, isBlobUrl]);
  
  // Update currentUrl whenever the url prop changes
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
    setVideoReady(false);
    
    // If onRefresh is provided, call it
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleVideoLoaded = () => {
    logger.log('Video loaded and ready for playback');
    setVideoReady(true);
  };

  // If URL is not valid, return null instead of showing empty player
  if (!isValidUrl || !currentUrl) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Always show poster explicitly for mobile */}
      {isMobile && posterUrl && !currentError && (
        <div 
          className="absolute inset-0 bg-cover bg-center z-10"
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
      )}
      
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
          autoPlay={isHovering && !isMobile}
          muted={true}
          className="w-full h-full object-cover"
          onError={handleError}
          poster={posterUrl || undefined}
          playOnHover={!isMobile}
          containerRef={containerRef}
          showPlayButtonOnHover={false}
          isHovering={isHovering}
          onLoadedData={handleVideoLoaded}
          isMobile={isMobile}
          showPlayButtonOnMobile={showPlayButtonOnMobile}
        />
      )}
      
      {videoId && (
        <div className="absolute bottom-2 right-2 z-20">
          <Link to={`/videos/${videoId}`}>
            <Button size="sm" variant="secondary" className="gap-1 opacity-90 hover:opacity-100">
              <Eye className="h-3 w-3" />
              View
            </Button>
          </Link>
        </div>
      )}
      
      {onRefresh && currentError && (
        <div className="absolute top-2 right-2 z-20">
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
      
      {isMobile && !currentError && showPlayButtonOnMobile && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-black/30 rounded-full p-3 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default StandardVideoPreview;
