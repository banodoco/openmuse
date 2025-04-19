import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Check, X, Play, ArrowUpRight, Trash, Star } from 'lucide-react';
import { VideoEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import VideoPreview from '../VideoPreview';
import { Logger } from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

const logger = new Logger('VideoCard');

interface VideoCardProps {
  video: VideoEntry;
  isAdmin: boolean;
  isAuthorized: boolean;
  onOpenLightbox: (video: VideoEntry) => void;
  onApproveVideo?: (videoId: string) => Promise<void>;
  onRejectVideo?: (videoId: string) => Promise<void>;
  onDeleteVideo?: (videoId: string) => Promise<void>;
  onSetPrimaryMedia?: (mediaId: string) => Promise<void>;
  isHovering?: boolean;
  onHoverChange?: (isHovering: boolean) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isAdmin,
  isAuthorized,
  onOpenLightbox,
  onApproveVideo,
  onRejectVideo,
  onDeleteVideo,
  onSetPrimaryMedia,
  isHovering = false,
  onHoverChange
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHoveringRef = useRef(isHovering);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
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
    
    if (video.metadata?.placeholder_image) {
      setThumbnailUrl(video.metadata.placeholder_image);
    }
    
    fetchCreatorProfile();
  }, [video.user_id, video.metadata]);
  
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = event.target as HTMLVideoElement;
    if (videoElement.videoWidth && videoElement.videoHeight) {
      setAspectRatio(videoElement.videoWidth / videoElement.videoHeight);
    } else {
      if (!aspectRatio) { 
        setAspectRatio(16/9);
      }
    }
  };
  
  const handleMouseEnter = () => {
    logger.log(`VideoCard: Mouse entered for ${video.id}`);
    if (onHoverChange && !isHoveringRef.current) {
      logger.log(`VideoCard: Notifying parent of hover start for ${video.id}`);
      onHoverChange(true);
    }
  };
  
  const handleMouseLeave = () => {
    logger.log(`VideoCard: Mouse left for ${video.id}`);
    if (onHoverChange && isHoveringRef.current) {
      logger.log(`VideoCard: Notifying parent of hover end for ${video.id}`);
      onHoverChange(false);
    }
  };
  
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
    const currentStatus = video.admin_status || 'Listed';
    const isActive = currentStatus === status;
    
    return cn(
      "text-xs h-7 w-7 p-0",
      isActive && status === 'Curated' && "bg-green-500 text-white hover:bg-green-600",
      isActive && status === 'Listed' && "bg-blue-500 text-white hover:bg-blue-600",
      isActive && status === 'Rejected' && "bg-orange-500 text-white hover:bg-orange-600",
      !isActive && "bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm",
      "rounded-md shadow-sm"
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
    if (onRejectVideo) onRejectVideo(video.id);
  };
  
  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    logger.log(`[VideoCard] handleDeleteConfirm triggered for video ID: ${video.id}`);
    if (!onDeleteVideo) {
      logger.warn(`[VideoCard] onDeleteVideo prop is missing for video ID: ${video.id}`);
      return;
    }
    
    logger.log(`[VideoCard] Calling onDeleteVideo prop for video ID: ${video.id}`);
    setIsDeleting(true);
    try {
      await onDeleteVideo(video.id);
      logger.log(`[VideoCard] onDeleteVideo prop finished successfully for video ID: ${video.id}`);
    } catch (error) { 
      logger.error(`[VideoCard] Error executing onDeleteVideo prop for video ID ${video.id}:`, error);
    } finally {
      logger.log(`[VideoCard] handleDeleteConfirm finished, setting isDeleting=false for video ID: ${video.id}`);
      setIsDeleting(false); 
    }
  };
  
  const handleSetPrimary = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSetPrimaryMedia && !video.is_primary) {
      logger.log(`[VideoCard] Calling onSetPrimaryMedia for video ID: ${video.id}`);
      onSetPrimaryMedia(video.id);
    }
  };
  
  const isProfilePage = location.pathname.includes('/profile/');
  const isLoRAAssetPage = location.pathname.includes('/assets/loras/');
  
  logger.log(`VideoCard rendering for ${video.id}, isHovering: ${isHovering}`);
  
  return (
    <div 
      ref={cardRef}
      key={video.id} 
      className="relative z-10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 mb-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onOpenLightbox(video)}
      data-hovering={isHovering ? "true" : "false"}
      data-video-id={video.id}
    >
      <div 
        className="w-full overflow-hidden bg-muted relative max-h-[75vh] group"
        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16/9' }}
      >
        <div className="absolute inset-0 w-full h-full">
          <VideoPreview
            key={`video-${video.id}`}
            url={video.url}
            title={video.metadata?.title || `Video by ${getCreatorName()}`}
            creator={getCreatorName()}
            className="w-full h-full object-cover"
            isHovering={isHovering}
            lazyLoad={false}
            thumbnailUrl={thumbnailUrl}
            onLoadedData={handleVideoLoad}
          />
          
          {isAuthorized && onSetPrimaryMedia && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute top-2 left-2 z-20 h-7 w-7 p-0 rounded-md shadow-sm",
                "bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm",
                video.is_primary && "text-yellow-400 hover:text-yellow-300"
              )}
              onClick={handleSetPrimary}
              title={video.is_primary ? "This is the primary media" : "Set as primary media"}
              disabled={video.is_primary}
            >
              <Star 
                className={cn("h-4 w-4", video.is_primary && "fill-current")} 
              />
            </Button>
          )}

          {!isMobile && (
            <div 
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none
                ${isHovering ? 'opacity-0' : 'opacity-100'}
              `}
            >
              <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm shadow-md">
                <Play className="h-6 w-6 text-white animate-pulse-opacity" />
              </div>
            </div>
          )}

          {!isMobile && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-between p-2 z-10">
              <div className="flex justify-between items-start">
                {video.metadata?.title ? (
                  <span className="text-white text-xs font-medium line-clamp-2 mr-2">
                    {video.metadata.title}
                  </span>
                ) : <span />}
                <ArrowUpRight className="text-white h-4 w-4 flex-shrink-0" />
              </div>

              {!isProfilePage && video.user_id && (
                <div className="self-start">
                  <span className="text-white text-xs bg-black/30 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                    By: {getCreatorName()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {isAdmin && (
        <div className="absolute top-2 right-2 flex space-x-1 z-20">
          <Button 
            variant="secondary" 
            size="icon" 
            className={getButtonStyle('Curated')}
            onClick={handleApprove}
            title="Curate video"
            disabled={!onApproveVideo}
          >
            <Check className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="secondary" 
            size="icon" 
            className={getButtonStyle('Listed')}
            onClick={handleList}
            title="List video"
            disabled={!onApproveVideo}
          >
            <span className="text-xs font-bold">L</span>
          </Button>
          
          <Button 
            variant="secondary"
            size="icon" 
            className={getButtonStyle('Rejected')}
            onClick={handleReject}
            title="Reject video"
            disabled={!onRejectVideo}
          >
            <X className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="icon" 
                className={cn(
                  "text-xs h-7 w-7 p-0 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm",
                  isDeleting && "opacity-50 cursor-not-allowed"
                )}
                title="Delete video permanently"
                disabled={!onDeleteVideo || isDeleting}
                onClick={(e) => e.stopPropagation()}
              >
                {isDeleting ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Trash className="h-4 w-4" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}> 
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this video?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The video file and its metadata will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={(e) => e.stopPropagation()} disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
};

VideoCard.displayName = 'VideoCard';

export default VideoCard;
