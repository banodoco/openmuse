
import React from 'react';
import { LoraAsset } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileVideo, ExternalLink, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import StandardVideoPreview from '../video/StandardVideoPreview';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { cn } from '@/lib/utils';

interface LoraCardProps {
  lora: LoraAsset;
  onClick?: () => void;
  selected?: boolean;
}

const LoraCard: React.FC<LoraCardProps> = ({ lora, onClick, selected }) => {
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [posterUrl, setPosterUrl] = React.useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const loadVideoUrl = async () => {
      if (lora.primaryVideo) {
        try {
          const url = await videoUrlService.getVideoUrl(lora.primaryVideo.video_location);
          setVideoUrl(url);
          
          // If there's an acting video, use it as poster
          if (lora.primaryVideo.acting_video_location) {
            const actingUrl = await videoUrlService.getVideoUrl(lora.primaryVideo.acting_video_location);
            setPosterUrl(actingUrl);
          }
        } catch (error) {
          console.error(`Error loading URL for video:`, error);
        }
      }
    };
    
    loadVideoUrl();
  }, [lora]);

  const handleError = (msg: string) => {
    console.error(`Error with video preview: ${msg}`);
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

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all h-full cursor-pointer hover:shadow-md",
        selected && "ring-2 ring-primary"
      )}
      onClick={handleCardClick}
    >
      <div className="aspect-video w-full overflow-hidden">
        {videoUrl && videoToUse ? (
          <StandardVideoPreview 
            url={videoUrl} 
            posterUrl={posterUrl}
            onError={handleError}
            videoId={videoToUse.id}
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
