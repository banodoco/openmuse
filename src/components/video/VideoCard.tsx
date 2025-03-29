
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Check, X, Play } from 'lucide-react';
import { VideoEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import VideoPreview from '../VideoPreview';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoCard');

interface VideoCardProps {
  video: VideoEntry;
  isAdmin: boolean;
  onOpenLightbox: (video: VideoEntry) => void;
  onApproveVideo?: (videoId: string) => void;
  onDeleteVideo?: (videoId: string) => void;
  isHovering?: boolean;
  onHoverChange?: (isHovering: boolean) => void;
  onTouch?: () => void;
  isMobile?: boolean;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isAdmin,
  onOpenLightbox,
  onApproveVideo,
  onDeleteVideo,
  isHovering = false,
  onHoverChange,
  onTouch,
  isMobile = false
}) => {
  const { user } = useAuth();
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHoveringRef = useRef(isHovering);
  
  useEffect(() => {
    isHoveringRef.current = isHovering;
    logger.log(`VideoCard: isHovering prop changed for ${video.id}: ${isHovering}`);
  }, [isHovering, video.id]);
  
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (video.user_id) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', video.user_id)
            .maybeSingle();
            
          if (profile && !error) {
            setCreatorDisplayName(profile.display_name || profile.username);
          }
        } catch (error) {
          console.error('Error fetching creator profile:', error);
        }
      }
    };
    
    if (video.metadata?.thumbnailUrl) {
      logger.log(`VideoCard: Using thumbnail from metadata for ${video.id}: ${video.metadata.thumbnailUrl.substring(0, 30)}...`);
      setThumbnailUrl(video.metadata.thumbnailUrl);
    } else {
      logger.log(`VideoCard: No thumbnail in metadata for ${video.id}`);
    }
    
    fetchCreatorProfile();
  }, [video.user_id, video.metadata, video.id]);
  
  const getCreatorName = () => {
    if (creatorDisplayName) {
      return creatorDisplayName;
    }
    
    if (video.metadata?.creatorName) {
      if (video.metadata.creatorName.includes('@')) {
        return video.metadata.creatorName.split('@')[0];
      }
      return video.metadata.creatorName;
    }
    
    if (video.reviewer_name) {
      if (video.reviewer_name.includes('@')) {
        return video.reviewer_name.split('@')[0];
      }
      return video.reviewer_name;
    }
    
    return 'Unknown';
  };
  
  const getButtonStyle = (status: string) => {
    const currentStatus = video.admin_approved || 'Listed';
    const isActive = currentStatus === status;
    
    return cn(
      "text-xs h-6 w-6",
      isActive && status === 'Curated' && "bg-green-500 text-white hover:bg-green-600",
      isActive && status === 'Listed' && "bg-blue-500 text-white hover:bg-blue-600",
      isActive && status === 'Rejected' && "bg-red-500 text-white hover:bg-red-600",
      !isActive && "bg-black/40 hover:bg-black/60 text-white"
    );
  };
  
  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onApproveVideo) onApproveVideo(video.id);
  };
  
  const handleList = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onApproveVideo) onApproveVideo(video.id);
  };
  
  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteVideo) onDeleteVideo(video.id);
  };
  
  const handleTouch = () => {
    logger.log(`VideoCard: Touch event for ${video.id}`);
    if (onTouch) {
      onTouch();
    }
  };
  
  return (
    <div 
      ref={cardRef}
      key={video.id} 
      className="relative rounded-lg overflow-hidden shadow-md group cursor-pointer"
      onMouseEnter={() => {
        if (onHoverChange && !isHoveringRef.current) {
          logger.log(`VideoCard: Notifying parent of hover start for ${video.id}`);
          onHoverChange(true);
        }
      }}
      onMouseLeave={() => {
        if (onHoverChange && isHoveringRef.current) {
          logger.log(`VideoCard: Notifying parent of hover end for ${video.id}`);
          onHoverChange(false);
        }
      }}
      onClick={() => onOpenLightbox(video)}
      data-hovering={isHovering ? "true" : "false"}
      data-video-id={video.id}
      data-has-thumbnail={thumbnailUrl ? "true" : "false"}
      data-is-mobile={isMobile ? "true" : "false"}
    >
      <div className="aspect-video">
        <div className="w-full h-full">
          <VideoPreview
            key={`video-${video.id}`}
            url={video.video_location}
            title={video.metadata?.title || `Video by ${getCreatorName()}`}
            creator={getCreatorName()}
            className="w-full h-full object-cover"
            isHovering={isHovering}
            lazyLoad={false}
            thumbnailUrl={thumbnailUrl}
            onTouch={handleTouch}
            isMobile={isMobile}
          />
          
          {isMobile ? (
            <div 
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none
                ${isHovering ? 'opacity-0' : 'opacity-70'}
              `}
              style={{ zIndex: 1 }}
            >
              <div className="bg-black/30 rounded-full p-3 backdrop-blur-sm">
                <Play className="h-6 w-6 text-white" />
              </div>
            </div>
          ) : (
            <div 
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none
                ${isHovering ? 'opacity-0' : 'opacity-100'}
              `}
            >
              <div className="bg-black/30 rounded-full p-3 backdrop-blur-sm">
                <Play className="h-6 w-6 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-2 bg-card">
        <h3 className="font-medium text-sm truncate">
          {video.metadata?.title || `Video by ${getCreatorName()}`}
        </h3>
        <p className="text-xs text-muted-foreground">By {getCreatorName()}</p>
      </div>
      
      {isAdmin && (
        <div className="absolute top-2 right-2 flex space-x-1 z-10">
          <Button 
            variant="secondary" 
            size="icon" 
            className={getButtonStyle('Curated')}
            onClick={handleApprove}
            title="Curate video"
          >
            <Check className="h-3 w-3" />
          </Button>
          
          <Button 
            variant="secondary" 
            size="icon" 
            className={getButtonStyle('Listed')}
            onClick={handleList}
            title="List video"
          >
            <span className="text-xs font-bold">L</span>
          </Button>
          
          <Button 
            variant="destructive" 
            size="icon" 
            className={getButtonStyle('Rejected')}
            onClick={handleReject}
            title="Reject video"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

VideoCard.displayName = 'VideoCard';

export default VideoCard;
