import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Check, X, Play, ArrowUpRight, Trash, Star } from 'lucide-react';
import { VideoEntry, VideoDisplayStatus } from '@/lib/types';
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
import VideoStatusControls from './VideoStatusControls';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import LoraCreatorInfo from '../lora/LoraCreatorInfo';

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
  onStatusUpdateComplete?: () => Promise<void>;
  onUpdateLocalVideoStatus?: (videoId: string, newStatus: VideoDisplayStatus, type: 'user' | 'assetMedia') => void;
  onVisibilityChange?: (videoId: string, isVisible: boolean) => void;
  shouldBePlaying?: boolean;
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
  onHoverChange,
  onStatusUpdateComplete,
  onUpdateLocalVideoStatus,
  onVisibilityChange,
  shouldBePlaying = false,
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHoveringRef = useRef(isHovering);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Determine context based on URL
  const pageContext = location.pathname.includes('/profile/') ? 'profile' : 'asset';
  logger.log(`VideoCard ${video.id}: Determined context: ${pageContext}`);

  useEffect(() => {
    isHoveringRef.current = isHovering;
    logger.log(`VideoCard: isHovering prop changed for ${video.id}: ${isHovering}`);
  }, [isHovering, video.id]);
  
  useEffect(() => {
    if (video.metadata?.placeholder_image) {
      setThumbnailUrl(video.metadata.placeholder_image);
    }
  }, [video.metadata]);
  
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
  
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    if (!onDeleteVideo) {
      setIsDeleting(false);
      return;
    }
    try {
      await onDeleteVideo(video.id);
    } catch (error) {
      setIsDeleting(false);
    }
  };
  
  const handleSetPrimary = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSetPrimaryMedia && !video.is_primary) {
      onSetPrimaryMedia(video.id);
    }
  };
  
  const isProfilePage = pageContext === 'profile';
  const isLoRAAssetPage = pageContext === 'asset';
  
  logger.log(`VideoCard rendering for ${video.id}, isHovering: ${isHovering}, context: ${pageContext}`);

  const handleStatusChange = async (newStatus: VideoDisplayStatus) => {
    setIsStatusUpdating(true);
    let updateType: 'user_status' | 'asset_media_status' | null = null;

    try {
      if (isProfilePage) {
        updateType = 'user_status';
        const { data, error } = await supabase
          .from('media')
          .update({ user_status: newStatus })
          .eq('id', video.id)
          .select();

        if (error) {
          throw error;
        }

        toast.success(`Video status updated to ${newStatus}`);
      } else {
        updateType = 'asset_media_status';
        const assetId = video.metadata?.assetId || video.associatedAssetId;
        if (!assetId) {
          throw new Error('Asset ID is missing');
        }

        const { data, error } = await supabase
          .from('asset_media')
          .update({ status: newStatus })
          .eq('asset_id', assetId)
          .eq('media_id', video.id)
          .select();

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          // Consider if this is an error or expected behavior
        }

        toast.success(`Video status updated to ${newStatus}`);
      }
      
      if (onUpdateLocalVideoStatus) {
        onUpdateLocalVideoStatus(video.id, newStatus, updateType === 'user_status' ? 'user' : 'assetMedia');
      } else {
        if (onStatusUpdateComplete) {
          onStatusUpdateComplete();
        }
      }
    } catch (error) {
      toast.error('Failed to update video status');
    }
  };
  
  // Log the full video object on render for debugging
  useEffect(() => {
    // logger.log(`{ITEMSHOWINGBUG} VideoCard Rendering with video prop (ID: ${video.id}) (user_status: ${video.user_status}, assetMediaDisplayStatus: ${video.assetMediaDisplayStatus}):`, video);
  }, [video]); // Rerun if video object changes
  
  // Callback from VideoPlayer (via VideoPreview)
  const handleVisibilityChange = useCallback((visible: boolean) => {
    logger.log(`VideoCard ${video.id}: Visibility changed to ${visible}`);
    setIsVisible(visible);
    if (onVisibilityChange) {
      onVisibilityChange(video.id, visible);
    }
  }, [video.id, onVisibilityChange]);
  
  // Determine the relevant status to pass to the controls
  const currentRelevantStatus = isProfilePage ? video.user_status : video.assetMediaDisplayStatus;

  return (
    <div 
      ref={cardRef}
      key={video.id} 
      className={cn(
        "relative z-10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 mb-4",
        currentRelevantStatus === 'Hidden' && isAuthorized && "opacity-50 grayscale hover:opacity-75"
      )}
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
            onVisibilityChange={handleVisibilityChange}
            shouldBePlaying={shouldBePlaying}
          />

          {/* Expand Icon for Mobile - Now Bottom Right */}
          {isMobile && (
            <div 
              className="absolute bottom-2 right-2 z-20 p-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none"
              title="Tap to expand"
            >
              <ArrowUpRight className="h-4 w-4 text-white/80" />
            </div>
          )}

          {/* Title and creator info for mobile (now top left) */}
          {isMobile && !isProfilePage && (
            <div
              className="absolute top-2 left-2 z-20 bg-black/40 backdrop-blur-sm rounded-md p-1.5 max-w-[70%] pointer-events-none"
            >
              {video.metadata?.title && (
                <span className="block text-white text-xs font-medium leading-snug line-clamp-2">
                  {video.metadata.title}
                </span>
              )}
              {video.user_id && (
                <div className="mt-0.5">
                  <LoraCreatorInfo
                    asset={{ user_id: video.user_id } as any}
                    avatarSize="h-4 w-4"
                    textSize="text-xs"
                    overrideTextColor="text-white/80"
                  />
                </div>
              )}
            </div>
          )}

          {/* Status controls at bottom left */}
          {isAuthorized && (
            <div className={cn(
              "absolute bottom-2 left-2 z-50 transition-opacity duration-200",
              !isMobile && "opacity-0 group-hover:opacity-100" // Apply hover effect only on desktop
            )} onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }} style={{ pointerEvents: 'all' }}>
              <VideoStatusControls
                status={currentRelevantStatus}
                onStatusChange={handleStatusChange}
                className=""
              />
            </div>
          )}

          {/* Delete and primary buttons at top right (Adjust positioning if mobile expand icon is present) */}
          {isAuthorized && (
            <div 
              className={cn(
                "absolute top-2 right-2 z-50 flex gap-2",
                !isMobile && "opacity-0 group-hover:opacity-100 transition-opacity duration-200" // Apply hover effect only on desktop
              )}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
              }}
              style={{ pointerEvents: 'all' }}
            >
              {isLoRAAssetPage && onSetPrimaryMedia && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 p-0 rounded-md shadow-sm",
                    "bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm",
                    video.is_primary && "text-yellow-400 hover:text-yellow-300"
                  )}
                  onClick={handleSetPrimary}
                  title={video.is_primary ? "This is the primary media" : "Make primary video"}
                  disabled={video.is_primary}
                >
                  <Star className={cn("h-4 w-4", video.is_primary && "fill-current text-yellow-400")} />
                </Button>
              )}

              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className={cn(
                        "h-7 w-7 p-0 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm",
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
              )}
            </div>
          )}

          {/* Play Button overlay (only shown on hover on non-mobile) */}
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

          {/* Gradient overlay and text (only shown on hover on non-mobile) */}
          {!isMobile && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-between p-2 z-10">
              <div className="flex flex-col items-start">
                {video.metadata?.title && (
                  <span className="text-white text-sm font-medium line-clamp-2 mr-2 pointer-events-auto">
                    {video.metadata.title}
                  </span>
                )}
                {!isProfilePage && video.user_id && (
                  <div 
                    style={{ pointerEvents: 'auto', position: 'relative', zIndex: 20 }} 
                    className="mt-0.5" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LoraCreatorInfo
                      asset={{ user_id: video.user_id } as any}
                      avatarSize="h-4 w-4"
                      textSize="text-xs"
                      overrideTextColor="text-white/80"
                    />
                  </div>
                )}
              </div>
              <div /> {/* Empty div to maintain flex spacing */}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Click Indicator - Bottom Right */}
      {!isMobile && (
        <div 
          className={cn(
            "absolute bottom-2 right-2 z-20 p-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-300" // Only show on hover
          )}
          title="Click to view details"
        >
          <ArrowUpRight className="h-4 w-4 text-white/80" />
        </div>
      )}
    </div>
  );
};

VideoCard.displayName = 'VideoCard';

export default VideoCard;
