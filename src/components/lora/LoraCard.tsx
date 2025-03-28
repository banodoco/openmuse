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
import { isValidVideoUrl } from '@/lib/utils/videoUtils';

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
  const [hasValidVideo, setHasValidVideo] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const navigate = useNavigate();

  const loadVideoUrl = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setHasValidVideo(false);
    
    let hasDbRecord = false;
    
    if (lora.primaryVideo?.id) {
      try {
        const dbUrl = await videoUrlService.lookupUrlFromDatabase(lora.primaryVideo.id);
        if (dbUrl) {
          hasDbRecord = true;
          setCanRefresh(true);
        }
      } catch (error) {
        console.error(`Error checking database for media ID ${lora.primaryVideo.id}:`, error);
      }
    }
    
    if (!hasDbRecord && lora.id) {
      try {
        const assetDbUrl = await videoUrlService.lookupUrlFromDatabase(lora.id);
        if (assetDbUrl) {
          hasDbRecord = true;
          setCanRefresh(true);
        }
      } catch (error) {
        console.error(`Error checking database for asset ID ${lora.id}:`, error);
      }
    }
    
    if (lora.primaryVideo) {
      try {
        if (!lora.primaryVideo.video_location) {
          console.warn(`No video location available for LoRA ${lora.name}`);
          setLoadError('No video available');
          setIsLoading(false);
          return;
        }
        
        if (lora.primaryVideo.id) {
          const dbUrl = await videoUrlService.lookupUrlFromDatabase(lora.primaryVideo.id);
          if (dbUrl && isValidVideoUrl(dbUrl)) {
            setVideoUrl(dbUrl);
            setHasValidVideo(true);
            console.log(`Successfully loaded database URL for LoRA ${lora.name}`);
          } else {
            const url = await videoUrlService.getVideoUrl(lora.primaryVideo.video_location);
            
            if (!url || !isValidVideoUrl(url)) {
              console.warn(`Empty or invalid URL returned for LoRA ${lora.name}`);
              setLoadError('Video preview unavailable');
            } else {
              setVideoUrl(url);
              setHasValidVideo(true);
              console.log(`Successfully loaded video URL for LoRA ${lora.name}`);
            }
          }
        } else {
          const url = await videoUrlService.getVideoUrl(lora.primaryVideo.video_location);
          
          if (!url || !isValidVideoUrl(url)) {
            console.warn(`Empty or invalid URL returned for LoRA ${lora.name}`);
            setLoadError('Video preview unavailable');
          } else {
            setVideoUrl(url);
            setHasValidVideo(true);
            console.log(`Successfully loaded video URL for LoRA ${lora.name}`);
          }
        }
        
        if (lora.primaryVideo.acting_video_location) {
          const actingUrl = await videoUrlService.getVideoUrl(lora.primaryVideo.acting_video_location);
          if (actingUrl && isValidVideoUrl(actingUrl)) {
            setPosterUrl(actingUrl);
          }
        }
      } catch (error) {
        console.error(`Error loading URL for video ${lora.id}:`, error);
        setLoadError('Error loading video preview');
      }
    } else if (lora.videos && lora.videos.length > 0) {
      let foundValidVideo = false;
      
      for (const video of lora.videos) {
        if (!video.video_location) continue;
        
        try {
          const url = await videoUrlService.getVideoUrl(video.video_location);
          
          if (url && isValidVideoUrl(url)) {
            setVideoUrl(url);
            setHasValidVideo(true);
            foundValidVideo = true;
            break;
          }
        } catch (error) {
          console.error(`Error loading video for LoRA ${lora.id}:`, error);
        }
      }
      
      if (!foundValidVideo) {
        setLoadError('No valid video available');
      }
    } else {
      setLoadError('No video available');
      setCanRefresh(false);
    }
    
    setIsLoading(false);
    setIsRefreshing(false);
  }, [lora]);

  const handleRefreshVideo = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    
    try {
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
    
    const handleUrlRefreshed = (event: CustomEvent) => {
      const { original, fresh } = event.detail;
      
      if (lora.primaryVideo && lora.primaryVideo.video_location === original) {
        console.log(`Video URL refreshed for LoRA ${lora.name}`);
        setVideoUrl(fresh);
      } else if (lora.videos && lora.videos.length > 0 && 
                lora.videos[0].video_location === original) {
        setVideoUrl(fresh);
      }
    };
    
    document.addEventListener('videoUrlRefreshed', handleUrlRefreshed as EventListener);
    
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
    setHasValidVideo(false);
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
  
  const isBlobError = videoToUse?.video_location?.startsWith('blob:');
  const hasDatabaseId = videoToUse?.id ? true : false;

  const getApprovalStatusBadge = (status: string | null) => {
    switch (status) {
      case 'Curated':
        return <Badge className="bg-green-500">Curated</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      case 'Listed':
      default:
        return <Badge variant="outline">Listed</Badge>;
    }
  };

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
        ) : loadError || !hasValidVideo ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
            <FileVideo className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">{loadError || 'No valid video'}</span>
            
            {canRefresh && (
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
            
            {isBlobError && canRefresh && (
              <p className="text-xs text-amber-600 mt-1 px-2 text-center">
                The temporary URL has expired
              </p>
            )}
          </div>
        ) : videoUrl && videoToUse && hasValidVideo ? (
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
