
import React from 'react';
import { AlertCircle, RefreshCw, ExternalLink, AlertTriangle, Database, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logger } from '@/lib/logger';
import { getVideoFormat } from '@/lib/utils/videoUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { supabaseStorage } from '@/lib/supabaseStorage';

const logger = new Logger('VideoPreviewError');

interface VideoPreviewErrorProps {
  error: string;
  onRetry: () => void;
  details?: string;
  videoSource?: string;
  canRecover?: boolean;
}

const VideoPreviewError: React.FC<VideoPreviewErrorProps> = ({ 
  error, 
  onRetry, 
  details,
  videoSource,
  canRecover = false
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
  
  // State to track if we're actively refreshing
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [debugInfo, setDebugInfo] = React.useState<string | null>(null);

  // Try to extract video ID from URL for more advanced recovery
  const extractVideoId = () => {
    if (!videoSource) return null;
    
    // Try to extract UUID
    const uuidMatch = videoSource.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
    return uuidMatch?.[1] || null;
  };

  // Handle more aggressive URL refresh for blob URLs
  const handleExpiredBlobRefresh = async () => {
    if (!videoSource || !videoSource.startsWith('blob:') || !canRecover) {
      return handlePageRefresh();
    }
    
    setIsRefreshing(true);
    setDebugInfo(null);
    
    try {
      logger.log(`Attempting to recover expired blob URL: ${videoSource.substring(0, 30)}...`);
      
      // Try to extract video ID from URL
      const videoId = extractVideoId();
      
      if (videoId) {
        setDebugInfo(`Found video ID: ${videoId}. Trying direct database lookup...`);
        
        // Try to directly fetch the URL from database using the media ID
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('id, url, type')
          .eq('id', videoId)
          .maybeSingle();
          
        if (mediaError) {
          logger.error("Error querying media table:", mediaError);
          setDebugInfo((prev) => `${prev}\nError querying database: ${mediaError.message}`);
        }
        
        if (mediaData) {
          setDebugInfo((prev) => `${prev}\nFound media record. URL: ${mediaData.url?.substring(0, 30)}...`);
          
          // If we have a permanent URL, use that
          if (mediaData.url && !mediaData.url.startsWith('blob:')) {
            logger.log(`Found permanent URL in database: ${mediaData.url.substring(0, 30)}...`);
            
            // Dispatch custom event to notify components of the refreshed URL
            const refreshEvent = new CustomEvent('videoUrlRefreshed', {
              detail: { original: videoSource, fresh: mediaData.url }
            });
            document.dispatchEvent(refreshEvent);
            toast.success("Recovered permanent video URL");
            onRetry();
            return;
          }
        }
      }
      
      setDebugInfo((prev) => `${prev}\nFailed to recover video. Please refresh the page.`);
      toast.error("Could not recover video. Please refresh the page.");
    } catch (error) {
      logger.error('Error recovering blob URL:', error);
      setDebugInfo(`Error: ${error instanceof Error ? error.message : String(error)}`);
      toast.error("Could not refresh video. Please reload the page.");
    } finally {
      setIsRefreshing(false);
    }
  };

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
            {canRecover && (
              <p className="mt-1">Click "Recover Video" to retrieve the permanent URL.</p>
            )}
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
        
        {debugInfo && (
          <div className="mb-3">
            <details className="text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer">Debug info</summary>
              <pre className="text-xs text-muted-foreground p-2 bg-muted rounded overflow-auto max-h-[120px] mt-1 text-left whitespace-pre-wrap">
                {debugInfo}
              </pre>
            </details>
          </div>
        )}
        
        <div className="flex flex-wrap justify-center gap-2">
          {isBlobError && canRecover ? (
            <Button 
              size="sm" 
              onClick={handleExpiredBlobRefresh} 
              variant="default" 
              className="gap-1"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {isRefreshing ? "Recovering..." : "Recover Video"}
            </Button>
          ) : (
            <Button size="sm" onClick={onRetry} variant="default" className="gap-1">
              <RefreshCw className="h-3 w-3" /> Try again
            </Button>
          )}
          
          <Button size="sm" onClick={handlePageRefresh} variant="outline">
            Refresh page
          </Button>
          
          {videoSource && videoSource.startsWith('http') && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={(e) => {
                e.stopPropagation();
                window.open(videoSource, '_blank');
              }}
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
