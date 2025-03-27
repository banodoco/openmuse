
import React from 'react';
import { AlertCircle, ExternalLink, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logger } from '@/lib/logger';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

  const handleRefreshClick = () => {
    logger.log('Manually refreshing video...');
    toast.info('Attempting to refresh video...');
    onRetry();
  };

  const handlePageRefresh = () => {
    logger.log('Refreshing entire page...');
    toast.info('Refreshing page to retrieve latest video data...');
    window.location.reload();
  };

  const handleFetchPermanentUrl = async () => {
    if (!videoSource) {
      toast.error('No video source available to fetch permanent URL');
      return;
    }

    logger.log('Attempting to fetch permanent URL from database...');
    toast.loading('Retrieving permanent URL...');

    try {
      // Try to extract an ID from the URL or path
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = videoSource.match(uuidPattern) || window.location.pathname.match(uuidPattern);
      const possibleId = match ? match[0] : null;

      if (!possibleId) {
        toast.error('Could not determine video ID from URL');
        return;
      }

      // Try to find the media entry by ID
      const { data: media, error: mediaError } = await supabase
        .from('media')
        .select('url')
        .eq('id', possibleId)
        .maybeSingle();

      if (mediaError) {
        logger.error('Error fetching media:', mediaError);
        toast.error('Could not retrieve permanent URL from database');
        return;
      }

      if (media && media.url) {
        logger.log(`Found permanent URL in database: ${media.url}`);
        toast.success('Found permanent URL');
        
        // Use the new permanent URL
        localStorage.setItem(`video_url_cache_${possibleId}`, JSON.stringify({
          url: media.url,
          timestamp: Date.now()
        }));
        
        // Notify of URL update and trigger retry
        document.dispatchEvent(new CustomEvent('videoUrlRefreshed', { 
          detail: { original: videoSource, fresh: media.url }
        }));
        
        onRetry();
      } else {
        toast.error('No permanent URL found in database');
      }
    } catch (error) {
      logger.error('Error in fetchPermanentUrl:', error);
      toast.error('Failed to retrieve permanent URL');
    }
  };

  // Customize error message for specific error types
  const getActionText = () => {
    if (error.includes('could not be loaded from storage')) {
      return 'The video may have been moved or deleted from storage. Try refreshing to retrieve the updated URL.';
    }
    if (error.includes('URL safety check') || (details && details.includes('URL safety check'))) {
      return 'This is likely due to browser security restrictions. Try refreshing the entire page, or try a different browser.';
    }
    if (error.includes('blob') || (details && details.includes('blob'))) {
      return 'The video link may have expired. Click "Fetch permanent URL" to retrieve a direct link from the database.';
    }
    if (error.includes('security') || error.includes('blocked')) {
      return 'Your browser is blocking this video for security reasons. Try using a different browser or refreshing the page.';
    }
    return '';
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-background p-4 rounded-lg max-w-[90%] text-center">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
        <h4 className="font-medium text-sm mb-1">Error loading video</h4>
        <p className="text-xs text-muted-foreground mb-2">{error}</p>
        
        {getActionText() && (
          <p className="text-xs text-amber-600 mt-1 mb-2">{getActionText()}</p>
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
          <Button size="sm" onClick={handleRefreshClick} variant="default" className="gap-1">
            <RefreshCw className="h-3 w-3" /> Try again
          </Button>
          
          <Button size="sm" onClick={handleFetchPermanentUrl} variant="secondary" className="gap-1">
            <Info className="h-3 w-3" /> Fetch permanent URL
          </Button>
          
          <Button size="sm" onClick={handlePageRefresh} variant="outline" className="gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh page
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoPreviewError;
