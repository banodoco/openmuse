
import React, { useState, useEffect, useCallback } from 'react';
import { LoraAsset } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileVideo, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import StandardVideoPreview from '../video/StandardVideoPreview';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LoraCardProps {
  lora: LoraAsset;
  onClick?: () => void;
  selected?: boolean;
}

const LoraCard: React.FC<LoraCardProps> = ({ lora, onClick, selected }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  const loadVideoUrl = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    
    if (lora.primaryVideo) {
      try {
        console.log(`Loading video for LoRA ${lora.name} with location:`, 
          lora.primaryVideo.video_location.substring(0, 30) + '...');
        
        const url = await videoUrlService.getVideoUrl(lora.primaryVideo.video_location);
        
        if (!url) {
          console.warn(`Empty URL returned for LoRA ${lora.name}`);
          setLoadError('Video preview unavailable');
        } else {
          setVideoUrl(url);
          console.log(`Successfully loaded video URL for LoRA ${lora.name}`);
        }
        
        // If there's an acting video, use it as poster
        if (lora.primaryVideo.acting_video_location) {
          const actingUrl = await videoUrlService.getVideoUrl(lora.primaryVideo.acting_video_location);
          setPosterUrl(actingUrl);
        }
      } catch (error) {
        console.error(`Error loading URL for video ${lora.id}:`, error);
        setLoadError('Error loading video preview');
      }
    } else if (lora.videos && lora.videos.length > 0) {
      // Fallback to first video if primary is not available
      try {
        const firstVideo = lora.videos[0];
        const url = await videoUrlService.getVideoUrl(firstVideo.video_location);
        
        if (!url) {
          setLoadError('Video preview unavailable');
        } else {
          setVideoUrl(url);
        }
      } catch (error) {
        console.error(`Error loading fallback video for LoRA ${lora.id}:`, error);
        setLoadError('Error loading video preview');
      }
    } else {
      setLoadError('No video available');
    }
    
    setIsLoading(false);
    setIsRefreshing(false);
  }, [lora]);

  // Add a function to manually refresh the video URL
  const handleRefreshVideo = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    
    try {
      // Attempt to force refresh the URL from the database
      if (lora.primaryVideo) {
        const freshUrl = await videoUrlService.forceRefreshUrl(lora.primaryVideo.video_location);
        if (freshUrl) {
          setVideoUrl(freshUrl);
          toast.success("Video preview refreshed");
        } else {
          setLoadError('Could not refresh video preview');
          toast.error("Could not refresh video preview");
        }
      } else if (lora.videos && lora.videos.length > 0) {
        const freshUrl = await videoUrlService.forceRefreshUrl(lora.videos[0].video_location);
        if (freshUrl) {
          setVideoUrl(freshUrl);
          toast.success("Video preview refreshed");
        } else {
          setLoadError('Could not refresh video preview');
          toast.error("Could not refresh video preview");
        }
      }
    } catch (error) {
      console.error("Error refreshing video URL:", error);
      setLoadError('Error refreshing video');
      toast.error("Error refreshing video preview");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  useEffect(() => {
    loadVideoUrl();
    
    // Listen for URL refresh events
    const handleUrlRefreshed = (event: CustomEvent) => {
      const { original, fresh } = event.detail;
      
      // Check if this event is relevant to our video
      if (lora.primaryVideo && lora.primaryVideo.video_location === original) {
        console.log(`Video URL refreshed for LoRA ${lora.name}`);
        setVideoUrl(fresh);
      } else if (lora.videos && lora.videos.length > 0 && 
                lora.videos[0].video_location === original) {
        setVideoUrl(fresh);
      }
    };
    
    document.addEventListener('videoUrlRefreshed', handleUrlRefreshed as EventListener);
    
    // Clean up function to revoke any object URLs when unmounting
    return () => {
      document.removeEventListener('videoUrlRefreshed', handleUrlRefreshed as EventListener);
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
      if (posterUrl && posterUrl.startsWith('blob:')) {
        URL.revokeObjectURL(posterUrl);
      }
    };
  }, [lora, loadVideoUrl]);

  const handleError = (msg: string) => {
    console.error(`Error with video preview for LoRA ${lora.name}: ${msg}`);
    setLoadError(msg);
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/assets/loras/${lora.id}`);
    }
  };

  const primaryVideo = lora.primaryVideo;
  const firstVideo = lora.videos && lora.videos.length > 0 ? lora.videos[0] : null;
  const videoToUse = primaryVideo || firstVideo;
  
  // Determine if this is a blob URL issue or a missing video issue
  const isBlobError = videoToUse?.video_location?.startsWith('blob:');
  const hasDatabaseId = videoToUse?.id ? true : false;

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all h-full cursor-pointer hover:shadow-md",
        selected && "ring-2 ring-primary"
      )}
      onClick={handleCardClick}
    >
      <div className="aspect-video w-full overflow-hidden relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-xs text-muted-foreground">Loading preview...</span>
          </div>
        ) : loadError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
            <FileVideo className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">{loadError}</span>
            
            {/* Show refresh button for blob errors or database IDs */}
            {(isBlobError || hasDatabaseId) && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefreshVideo();
                }}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            )}
            
            {isBlobError && (
              <p className="text-xs text-amber-600 mt-1 px-2 text-center">
                The temporary URL has expired
              </p>
            )}
          </div>
        ) : videoUrl && videoToUse ? (
          <StandardVideoPreview 
            url={videoUrl} 
            posterUrl={posterUrl}
            onError={handleError}
            videoId={videoToUse.id}
            onRefresh={handleRefreshVideo}
            isRefreshing={isRefreshing}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <FileVideo className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base truncate">
            {lora.name}
          </CardTitle>
        </div>
        
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <Badge variant="outline" className="rounded-sm text-xs">
            LoRA
          </Badge>
          {primaryVideo?.metadata?.model && (
            <Badge variant="outline" className="rounded-sm text-xs">
              {primaryVideo.metadata.model}
            </Badge>
          )}
          {lora.videos && (
            <Badge variant="outline" className="rounded-sm text-xs">
              {lora.videos.length} video{lora.videos.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        {lora.description && (
          <CardDescription className="line-clamp-2 mt-1 text-xs">
            {lora.description}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="px-4 py-2 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created by:</span>
            <span className="font-medium">{lora.creator || 'Unknown'}</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="px-4 py-3 border-t flex justify-between mt-auto">
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs h-8 gap-1"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/assets/loras/${lora.id}`);
          }}
        >
          <Eye className="h-3 w-3" /> View
        </Button>
      </CardFooter>
    </Card>
  );
};

export default LoraCard;
