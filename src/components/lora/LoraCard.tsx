
import React, { useState, useEffect } from 'react';
import { LoraAsset, VideoEntry } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ArrowUpRight, FileVideo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Logger } from '@/lib/logger';
import VideoPreview from '../VideoPreview';

interface LoraCardProps {
  lora: LoraAsset;
}

const logger = new Logger('LoraCard');

const LoraCard: React.FC<LoraCardProps> = ({ lora }) => {
  const navigate = useNavigate();
  const [primaryVideoUrl, setPrimaryVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  
  useEffect(() => {
    const loadPrimaryVideoUrl = async () => {
      setIsLoadingVideo(true);
      try {
        if (lora.primaryVideo?.id) {
          const url = await videoUrlService.getVideoUrl(lora.primaryVideo.video_location);
          if (url) {
            setPrimaryVideoUrl(url);
            logger.log(`Successfully loaded database URL for LoRA ${lora.name}`);
          } else {
            logger.warn(`Empty or invalid URL returned for LoRA ${lora.name}`);
          }
        } else {
          // Try to get URL from other videos associated with this LoRA
          if (lora.videos && lora.videos.length > 0) {
            // Find first video that isn't rejected
            const firstVideo = lora.videos.find(v => v.admin_approved !== 'Rejected');
            if (firstVideo) {
              const url = await videoUrlService.getVideoUrl(firstVideo.video_location);
              if (url) {
                setPrimaryVideoUrl(url);
                logger.log(`Used fallback video for LoRA ${lora.name}`);
              }
            }
          }
        }
      } catch (error) {
        logger.error(`Error loading primary video URL for LoRA ${lora.name}:`, error);
      } finally {
        setIsLoadingVideo(false);
      }
    };
    
    loadPrimaryVideoUrl();
  }, [lora]);
  
  const handleNavigate = () => {
    navigate(`/assets/loras/${lora.id}`);
  };
  
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="aspect-video relative">
        {isLoadingVideo ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <FileVideo className="h-8 w-8 text-muted-foreground animate-pulse" />
          </div>
        ) : primaryVideoUrl ? (
          <VideoPreview 
            url={primaryVideoUrl} 
            className="w-full h-full" 
            title={lora.name}
            creator={lora.creator || 'Unknown'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <FileVideo className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-medium truncate">
            {lora.name}
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="px-4 py-2 text-sm flex-grow">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Created by:</span>
          <span className="font-medium">{lora.creator || 'Unknown'}</span>
        </div>
      </CardContent>
      
      <CardFooter className="px-4 py-3 border-t">
        <Button
          onClick={handleNavigate}
          className="w-full"
          variant="default"
        >
          <ArrowUpRight className="mr-2 h-4 w-4" />
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
};

export default LoraCard;
