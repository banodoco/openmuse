import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';

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
  alwaysShowInfo?: boolean;
  /** If true, forces creator info to only show on hover on desktop, overriding alwaysShowInfo for that element */
  forceCreatorHoverDesktop?: boolean;
  compact?: boolean;
  onFormatUnsupportedOnMobile?: (videoId: string) => void;
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
  alwaysShowInfo = false,
  forceCreatorHoverDesktop = false,
  compact = false,
  onFormatUnsupportedOnMobile,
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  // Attempt to seed thumbnail from several possible fields, defaulting to a
  // generic placeholder so the card never appears as a stark black square.
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() =>
    video.metadata?.placeholder_image ||
    (video as any).placeholder_image ||
    (video as any).thumbnailUrl ||
    '/placeholder.svg',
  );
  const previewRef = useRef<HTMLDivElement>(null);
  useFadeInOnScroll(previewRef);
  // ---------------------------------------------------------------
  // Use the dimensions calculated by the VideoGrid (displayW / displayH)
  // to seed the local aspect-ratio state so that the placeholder box
  // exactly matches the slot reserved by the grid on the very first
  // paint.  This eliminates the brief "misshaped" flash that was visible
  // before the video metadata loaded.
  // ---------------------------------------------------------------
  const [aspectRatio, setAspectRatio] = useState<number | null>(() => {
    // Prefer explicit displayW/H passed down from VideoGrid, if present
    // (DisplayVideoEntry extends VideoEntry so these can exist).
    const displayW = (video as any).displayW as number | undefined;
    const displayH = (video as any).displayH as number | undefined;

    if (displayW && displayH) {
      return displayW / displayH;
    }

    // Fall back to any aspectRatio provided at the top-level or in metadata.
    return (video as any).aspectRatio ?? video.metadata?.aspectRatio ?? null;
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  /**
   * Local hover state allows the card to react immediately to pointer
   * interactions instead of waiting for the parent grid to propagate the
   * `isHovering` prop back down. This eliminates a render-round-trip and
   * makes the placeholder hide + video playback start perceptibly faster.
   */
  const [localHovering, setLocalHovering] = useState(false);
  
  // Merge the externally-controlled hover prop with our local state so we
  // can respond instantly while still respecting whichever card is marked
  // as the current hover target by the parent grid.
  const combinedHovering = isHovering || localHovering;
  
  // Detect when the card itself enters the viewport (desktop only)
  const isInViewport = useIntersectionObserver(previewRef, {
    rootMargin: '0px 0px 300px 0px', // preload a bit before it actually appears
    threshold: 0.05,
  });
  
  // Determine context based on URL
  const pageContext = location.pathname.includes('/profile/') ? 'profile' : 'asset';
  // (debug) context determined

  useEffect(() => {
    if (video.metadata?.placeholder_image) {
      // (debug) placeholder cached
      setThumbnailUrl(video.metadata.placeholder_image);
    }
  }, [video.metadata]);
  
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = event.target as HTMLVideoElement;
    if (videoElement.videoWidth && videoElement.videoHeight) {
      const loadedAspectRatio = videoElement.videoWidth / videoElement.videoHeight;
      if (aspectRatio === null || Math.abs(aspectRatio - loadedAspectRatio) > 0.01) {
        setAspectRatio(loadedAspectRatio);
      }
    } else {
      if (aspectRatio === null) { 
        setAspectRatio(16/9);
      }
    }
  };
  
  const handleMouseEnter = () => {
    setLocalHovering(true);
    // Removed callback to parent to avoid triggering parent state updates / re-renders on every hover.
    // if (onHoverChange && !isHovering) {
    //   onHoverChange(true);
    // }
  };
  
  const handleMouseLeave = () => {
    setLocalHovering(false);
    // Removed callback to parent to avoid triggering parent state updates / re-renders on every hover.
    // if (onHoverChange && isHovering) {
    //   onHoverChange(false);
    // }
  };
  
  const getCreatorName = () => {
    // No creatorName on metadata, use reviewer_name or fallback
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
  
  // Display badge for videos curated/featured by OpenMuse
  const shouldShowBadge = video.admin_status === 'Curated' || video.admin_status === 'Featured';
  
  // (debug) render

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
    setIsVisible(visible);
    if (onVisibilityChange) {
      onVisibilityChange(video.id, visible);
    }
  }, [video.id, onVisibilityChange]);
  
  // Determine the relevant status to pass to the controls
  const currentRelevantStatus = isProfilePage ? video.user_status : video.assetMediaDisplayStatus;

  // No need to log every hover state change; handled in handlers.

  // NEW: Handler for VideoPlayer errors
  const handleVideoPlayerError = useCallback((message: string) => {
    logger.log(`[VideoCard] VideoPlayer reported error for video ${video.id}: ${message}`);
    // Check for the specific error message and if on mobile
    if (
      isMobile &&
      message === "The video source is not supported." && // This message comes from VideoPlayer's handleVideoError
      onFormatUnsupportedOnMobile
    ) {
      logger.log(`[VideoCard] Unsupported format for video ${video.id} on mobile. Calling onFormatUnsupportedOnMobile.`);
      onFormatUnsupportedOnMobile(video.id);
    }
    // If you have other generic error handling for VideoCard itself, it can go here.
  }, [isMobile, onFormatUnsupportedOnMobile, video.id]);

  // ---------------------------------------------------------------------------
  // Fetch Creator Profile (avatar + display name) when NOT on profile page
  // ---------------------------------------------------------------------------
  const [creatorProfile, setCreatorProfile] = useState<{ avatar_url: string | null; display_name: string | null; username: string | null } | null>(null);

  useEffect(() => {
    // Only fetch when we are NOT already on that creator's profile page
    if (isProfilePage) return;
    if (!video.user_id) return;

    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url, display_name, username')
          .eq('id', video.user_id)
          .single();
        if (cancelled) return;
        if (error) {
          console.warn('[VideoCard] Failed to fetch creator profile:', error.message);
        } else if (data) {
          setCreatorProfile(data as any);
        }
      } catch (err) {
        if (!cancelled) console.warn('[VideoCard] Error fetching creator profile:', err);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [video.user_id, isProfilePage]);

  const creatorAvatar = creatorProfile?.avatar_url ?? (video as any).creator_avatar_url ?? undefined;
  const creatorDisplayName = creatorProfile?.display_name || creatorProfile?.username || getCreatorName();

  // Insert new variables before the return block
  const isGeneration = isProfilePage && video.metadata?.classification === 'gen';
  const shouldAlwaysShowInfo = alwaysShowInfo && !isGeneration;

  return (
    <div 
      className={cn(
        "relative group overflow-hidden rounded-lg cursor-pointer transition-all duration-300 ease-in-out",
        "bg-card/60 backdrop-blur-sm",
        currentRelevantStatus === 'Hidden' && isAuthorized && "opacity-50 grayscale hover:opacity-75"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onOpenLightbox(video)}
      data-hovering={combinedHovering ? "true" : "false"}
      data-video-id={video.id}
    >
      <div 
        ref={previewRef}
        className="w-full overflow-hidden bg-muted relative max-h-none group"
        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16 / 9' }}
      >
        <div className="absolute inset-0 w-full h-full">
          <VideoPreview
            key={`video-${video.id}`}
            url={video.url}
            title={video.metadata?.title || `Video by ${getCreatorName()}`}
            creator={getCreatorName()}
            className="w-full h-full object-cover"
            isHovering={combinedHovering}
            lazyLoad={false}
            thumbnailUrl={thumbnailUrl}
            onLoadedData={handleVideoLoad}
            onVisibilityChange={handleVisibilityChange}
            shouldBePlaying={shouldBePlaying}
            onError={handleVideoPlayerError}
            isMobile={isMobile}
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

          {/* Title, badge, and creator info for mobile on profile */}
          {isMobile && (video.metadata?.title || (!isProfilePage && creatorDisplayName) || (isProfilePage && shouldShowBadge)) && (
            <div className="absolute top-2 left-2 z-20 flex flex-col">
              <div className="bg-black/30 backdrop-blur-sm rounded-md p-1.5 pointer-events-none flex flex-col gap-1">
                {/* Combine Badge and Title */}
                {(video.metadata?.title || (isProfilePage && shouldShowBadge)) && (
                  <div className="flex items-center space-x-1">
                    {isProfilePage && shouldShowBadge && (
                      <img
                        src="/reward.png"
                        alt="Featured by OpenMuse"
                        title="Featured by OpenMuse"
                        className="h-6 w-6 flex-shrink-0" // Adjusted size
                      />
                    )}
                    {video.metadata?.title && (
                      <span className="block text-white text-xs font-medium leading-snug">
                        {video.metadata.title}
                      </span>
                    )}
                  </div>
                )}
                {/* Only show creator info when NOT on profile page */}
                {!isProfilePage && creatorDisplayName && (() => {
                  const titleOrBadgeExists = video.metadata?.title || (isProfilePage && shouldShowBadge);
                  return (
                    <span className={cn(
                      "flex items-center space-x-1",
                      titleOrBadgeExists && "mt-1" // Conditional Margin
                    )}>
                      <Avatar className="h-4 w-4 border-0 bg-white/20">
                        <AvatarImage src={creatorAvatar} alt={creatorDisplayName} />
                        <AvatarFallback className="text-[8px] font-medium bg-white/20 text-white/90">
                          {creatorDisplayName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-white text-[10px] leading-none line-clamp-1">
                        {creatorDisplayName}
                      </span>
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Title, badge for desktop on profile when shouldAlwaysShowInfo is true */}
          {!isMobile && shouldAlwaysShowInfo && !forceCreatorHoverDesktop && (video.metadata?.title || (!isProfilePage && creatorDisplayName) || (isProfilePage && shouldShowBadge)) && (
            <div className="absolute top-2 left-2 z-20 flex flex-col">
              <div className="bg-black/30 backdrop-blur-sm rounded-md p-1.5 pointer-events-none flex flex-col gap-1">
                {/* Combine Badge and Title */}
                {(video.metadata?.title || (isProfilePage && shouldShowBadge)) && (
                  <div className="flex items-center space-x-1">
                     {isProfilePage && shouldShowBadge && (
                      <img
                        src="/reward.png"
                        alt="Featured by OpenMuse"
                        title="Featured by OpenMuse"
                        className="h-5 w-5 flex-shrink-0" // Adjusted size
                      />
                    )}
                    {video.metadata?.title && (
                      <span className="block text-white text-xs font-medium leading-snug">
                        {video.metadata.title}
                      </span>
                    )}
                  </div>
                )}
                {/* Creator Info (Only when NOT on profile page) */}
                {!isProfilePage && creatorDisplayName && (() => {
                  const titleOrBadgeExists = video.metadata?.title || (isProfilePage && shouldShowBadge);
                  return (
                    <span className={cn(
                      "flex items-center space-x-1",
                      titleOrBadgeExists && "mt-1" // Conditional Margin
                    )}>
                      <Avatar className="h-4 w-4 border-0 bg-white/20">
                        <AvatarImage src={creatorAvatar} alt={creatorDisplayName} />
                        <AvatarFallback className="text-[8px] font-medium bg-white/20 text-white/90">
                          {creatorDisplayName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-white text-[10px] leading-none line-clamp-1">
                        {creatorDisplayName}
                      </span>
                    </span>
                  );
                })()}
              </div>
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
                ${combinedHovering ? 'opacity-0' : 'opacity-100'} 
              `}
            >
              <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm shadow-md">
                <Play className="h-6 w-6 text-white animate-pulse-opacity" />
              </div>
            </div>
          )}

          {/* Desktop: Info overlay that shows on hover when info is not always visible */}
          {!isMobile && (!shouldAlwaysShowInfo || forceCreatorHoverDesktop) && (video.metadata?.title || (!isProfilePage && creatorDisplayName) || (isProfilePage && shouldShowBadge)) && (
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
              <div className="absolute top-2 left-2 z-20 flex flex-col">
                <div className="bg-black/30 backdrop-blur-sm rounded-md p-1.5 pointer-events-none flex flex-col gap-1">
                  {/* Combine Badge and Title */}
                  {(video.metadata?.title || (isProfilePage && shouldShowBadge)) && (
                    <div className="flex items-center space-x-1 pointer-events-auto"> {/* Added pointer-events-auto here */}
                       {isProfilePage && shouldShowBadge && (
                        <img
                          src="/reward.png"
                          alt="Featured by OpenMuse"
                          title="Featured by OpenMuse"
                          className="h-5 w-5 flex-shrink-0" // Adjusted size
                        />
                      )}
                      {video.metadata?.title && (
                        <span className="block text-white text-xs font-medium leading-snug">
                          {video.metadata.title}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Creator Info (Only when NOT on profile page) */}
                  {!isProfilePage && creatorDisplayName && (() => {
                    const titleOrBadgeExists = video.metadata?.title || (isProfilePage && shouldShowBadge);
                    return (
                      <span className={cn(
                        "flex items-center space-x-1 pointer-events-auto", // Added pointer-events-auto here previously
                        titleOrBadgeExists && "mt-1" // Conditional Margin
                      )}>
                        <Avatar className="h-4 w-4 border-0 bg-white/20">
                          <AvatarImage src={creatorAvatar} alt={creatorDisplayName} />
                          <AvatarFallback className="text-[8px] font-medium bg-white/20 text-white/90">
                            {creatorDisplayName[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-white text-[10px] leading-none line-clamp-1">
                          {creatorDisplayName}
                        </span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Click Indicator - Bottom Right (Keep this outside the video preview area) */}
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

// ---------------------------------------------------------------------------
// Memoization to prevent whole-grid re-renders on hover
// ---------------------------------------------------------------------------

// Only re-render when props that materially affect the card change.
const areEqual = (prev: Readonly<VideoCardProps>, next: Readonly<VideoCardProps>) => {
  // Primitive props that can toggle frequently
  if (prev.isHovering !== next.isHovering) return false;
  if (prev.shouldBePlaying !== next.shouldBePlaying) return false;

  // Auth / role flags
  if (prev.isAdmin !== next.isAdmin) return false;
  if (prev.isAuthorized !== next.isAuthorized) return false;

  // Display options
  if (prev.alwaysShowInfo !== next.alwaysShowInfo) return false;
  if (prev.forceCreatorHoverDesktop !== next.forceCreatorHoverDesktop) return false;

  // Video object reference – if the parent supplies a new object ref the
  // card should update.  Deep compare is avoided for perf.
  if (prev.video !== next.video) return false;

  // Check the new callback prop
  if (prev.onFormatUnsupportedOnMobile !== next.onFormatUnsupportedOnMobile) return false;

  return true; // No significant changes → skip re-render
};

const MemoizedVideoCard = memo(VideoCard, areEqual);

export default MemoizedVideoCard;
