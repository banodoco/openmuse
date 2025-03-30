
import React, { useState } from 'react';
import { LoraAsset } from '@/lib/types';
import { Link } from 'react-router-dom';
import VideoPreview from '../VideoPreview';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { MoveVertical } from 'lucide-react';

interface LoraCardProps {
  lora: LoraAsset;
  showExtras?: boolean;
  showPlayButtonOnMobile?: boolean;
}

const LoraCard: React.FC<LoraCardProps> = ({ 
  lora, 
  showExtras = false,
  showPlayButtonOnMobile = true,
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const isMobile = useIsMobile();
  
  // Find a video to display for the LoRA
  const previewVideo = lora.primaryVideo || (lora.videos && lora.videos.length > 0 ? lora.videos[0] : null);
  
  // Extract thumbnail URL if available
  let thumbnailUrl = null;
  if (previewVideo?.metadata?.thumbnailUrl) {
    thumbnailUrl = previewVideo.metadata.thumbnailUrl;
  }
  
  const videoUrl = previewVideo?.video_location || null;
  
  const handleMouseEnter = () => {
    setIsHovering(true);
  };
  
  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  // Display name from creatorDisplayName or creator or default
  const displayName = lora.creatorDisplayName || lora.creator || 'Unknown';
  
  // Time since creation
  let timeAgo = '';
  if (lora.created_at) {
    const createdAt = new Date(lora.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      timeAgo = 'Today';
    } else if (diffDays === 1) {
      timeAgo = 'Yesterday';
    } else if (diffDays < 7) {
      timeAgo = `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      timeAgo = `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      timeAgo = `${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      timeAgo = `${years} ${years === 1 ? 'year' : 'years'} ago`;
    }
  }
  
  return (
    <Link 
      to={`/assets/${lora.id}`} 
      className="group block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={cn(
        "rounded-lg overflow-hidden shadow transition-all bg-card",
        isHovering && "shadow-md"
      )}>
        <div className="aspect-video relative">
          {videoUrl ? (
            <VideoPreview 
              url={videoUrl} 
              isHovering={isHovering} 
              thumbnailUrl={thumbnailUrl}
              showPlayButtonOnMobile={showPlayButtonOnMobile}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <MoveVertical className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          )}
        </div>
        
        <div className="p-3">
          <div className="flex justify-between items-start">
            <h3 className="font-medium text-foreground truncate">{lora.name}</h3>
            {showExtras && lora.admin_approved === 'Curated' && (
              <span className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded">
                Curated
              </span>
            )}
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <p className="text-sm text-muted-foreground truncate">{displayName}</p>
            {timeAgo && (
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default LoraCard;
