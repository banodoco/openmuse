import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Check, X, Play, ArrowUpRight, Trash, Star, ListChecks, Flame, EyeOff, List as ListIcon, Loader2 } from 'lucide-react';
import { VideoEntry, VideoDisplayStatus, AdminStatus } from '@/lib/types';
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
import useDebouncedValue from '@/hooks/useDebouncedValue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

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
  onAdminStatusChange?: (videoId: string, newStatus: AdminStatus) => Promise<void>;
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
  assetPrimaryMediaId?: string | null;
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
  onAdminStatusChange,
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
  assetPrimaryMediaId,
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => {
    if (video.storage_provider === 'cloudflare-stream' && video.cloudflare_thumbnail_url) {
      return video.cloudflare_thumbnail_url;
    }
    return video.placeholder_image || // Use direct placeholder_image from VideoEntry first
           video.metadata?.placeholder_image || 
           (video as any).thumbnailUrl || // Legacy?
           '/placeholder.svg';
  });
  const previewRef = useRef<HTMLDivElement>(null);
  useFadeInOnScroll(previewRef);
  const [aspectRatio, setAspectRatio] = useState<number | null>(() => {
    const displayW = (video as any).displayW as number | undefined;
    const displayH = (video as any).displayH as number | undefined;
    if (displayW && displayH) {
      return displayW / displayH;
    }
    return (video as any).aspectRatio ?? video.metadata?.aspectRatio ?? null;
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isChangingAdminStatus, setIsChangingAdminStatus] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [localHovering, setLocalHovering] = useState(false);
  
  const debouncedLocalHovering = useDebouncedValue(localHovering, 200);

  const combinedHovering = isHovering || debouncedLocalHovering;
  const isInViewport = useIntersectionObserver(previewRef, {
    rootMargin: '0px 0px 300px 0px',
    threshold: 0.05,
  });
  const pageContext = location.pathname.includes('/profile/') ? 'profile' : 'asset';
  const isProfilePage = pageContext === 'profile';

  const adminDropdownClickedRef = useRef(false);

  // Determine if this video is the actual primary media
  const isActuallyPrimary = assetPrimaryMediaId ? video.id === assetPrimaryMediaId : video.is_primary;

  // Add a log for hover states on re-render
  console.log(`[VideoCardHoverDebug ${video.id}] Render - localHovering: ${localHovering}, combinedHovering: ${isHovering || localHovering}`);

  useEffect(() => {
    if (video.metadata?.placeholder_image) {
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
    console.log(`[VideoCardHoverDebug ${video.id}] MouseEnter - setting localHovering true`);
    setLocalHovering(true);
    if (onHoverChange) onHoverChange(true);
  };
  
  const handleMouseLeave = () => {
    console.log(`[VideoCardHoverDebug ${video.id}] MouseLeave - setting localHovering false`);
    setLocalHovering(false);
    if (onHoverChange) onHoverChange(false);
  };
  
  const getCreatorName = () => {
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
    if (onSetPrimaryMedia && !isActuallyPrimary) {
      onSetPrimaryMedia(video.id);
    }
  };
  
  const isLoRAAssetPage = pageContext === 'asset';
  const shouldShowBadge = video.admin_status === 'Curated' || video.admin_status === 'Featured';
  
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
        if (error) { throw error; }
        toast.success(`Video status updated to ${newStatus}`);
      } else {
        updateType = 'asset_media_status';
        const assetId = video.metadata?.assetId || video.associatedAssetId;
        if (!assetId) { throw new Error('Asset ID is missing'); }
        const { data, error } = await supabase
          .from('asset_media')
          .update({ status: newStatus })
          .eq('asset_id', assetId)
          .eq('media_id', video.id)
          .select();
        if (error) { throw error; }
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
  
  useEffect(() => {
    // logger.log(`{ITEMSHOWINGBUG} VideoCard Rendering with video prop (ID: ${video.id}) (user_status: ${video.user_status}, assetMediaDisplayStatus: ${video.assetMediaDisplayStatus}):`, video);
  }, [video]);
  
  const handleVisibilityChange = useCallback((visible: boolean) => {
    setIsVisible(visible);
    if (onVisibilityChange) {
      onVisibilityChange(video.id, visible);
    }
  }, [video.id, onVisibilityChange]);
  
  const currentRelevantStatus = isProfilePage ? video.user_status : video.assetMediaDisplayStatus;

  const handleVideoPlayerError = useCallback((message: string) => {
    logger.log(`[VideoCard] VideoPlayer reported error for video ${video.id}: ${message}`);
    if (
      isMobile &&
      message === "The video source is not supported." &&
      onFormatUnsupportedOnMobile
    ) {
      logger.log(`[VideoCard] Unsupported format for video ${video.id} on mobile. Calling onFormatUnsupportedOnMobile.`);
      onFormatUnsupportedOnMobile(video.id);
    }
  }, [isMobile, onFormatUnsupportedOnMobile, video.id]);

  const [creatorProfile, setCreatorProfile] = useState<{ avatar_url: string | null; display_name: string | null; username: string | null } | null>(null);

  useEffect(() => {
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
  const isGeneration = isProfilePage && video.metadata?.classification === 'gen';
  const shouldAlwaysShowInfo = alwaysShowInfo && !isGeneration;

  const handleVideoAdminStatusChange = async (newStatus: AdminStatus) => {
    if (!isAdmin || !onAdminStatusChange) return;
    setIsChangingAdminStatus(true);
    try {
      await onAdminStatusChange(video.id, newStatus);
    } catch (error) {
      logger.error(`Error setting video admin status to ${newStatus} for ${video.id}:`, error);
      toast.error(`Failed to set video admin status to ${newStatus}`);
    } finally {
      setIsChangingAdminStatus(false);
    }
  };

  const getAdminStatusIcon = (status: AdminStatus | null | undefined) => {
    switch (status) {
      case 'Featured': return <Flame className="h-4 w-4" />;
      case 'Curated': return <ListChecks className="h-4 w-4" />;
      case 'Listed': return <ListIcon className="h-4 w-4" />;
      case 'Hidden': return <EyeOff className="h-4 w-4" />;
      case 'Rejected': return <X className="h-4 w-4" />;
      default: return <ListIcon className="h-4 w-4" />;
    }
  };
  
  const getAdminStatusBadgeVariant = (status: AdminStatus | undefined | null) => {
    if (!status) return "bg-gray-200 text-gray-800";
    switch (status) {
      case 'Featured': return "bg-orange-200 text-orange-800";
      case 'Curated': return "bg-green-200 text-green-800";
      case 'Listed': return "bg-blue-200 text-blue-800";
      case 'Hidden': return "bg-gray-200 text-gray-800";
      case 'Rejected': return "bg-red-200 text-red-800";
      default: return "bg-gray-200 text-gray-800";
    }
  };

  const adminStatusOptions: AdminStatus[] = ['Featured', 'Curated', 'Listed', 'Hidden', 'Rejected'];
  const statusOptionColors: Record<AdminStatus, string> = {
    'Featured': 'bg-orange-50',
    'Curated': 'bg-green-50',
    'Listed': 'bg-blue-50',
    'Hidden': 'bg-gray-50',
    'Rejected': 'bg-red-50'
  };
   const isStatusEqual = (status1: AdminStatus | string | undefined | null, status2: AdminStatus): boolean => {
    return status1 === status2;
  };

  const videoSourceUrl = video.storage_provider === 'cloudflare-stream' && video.cloudflare_playback_hls_url 
    ? video.cloudflare_playback_hls_url 
    : video.url;

  return (
    <div 
      className={cn(
        "relative group overflow-hidden rounded-lg cursor-pointer transition-all duration-300 ease-in-out",
        "bg-card/60 backdrop-blur-sm",
        currentRelevantStatus === 'Hidden' && isAuthorized && !isAdmin && "opacity-50 grayscale hover:opacity-75"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClickCapture={(e) => {
        if (adminDropdownClickedRef.current) {
          console.log(`[VideoCardHoverDebug ${video.id}] onClickCapture - dropdown click detected, stopping propagation`);
          e.stopPropagation();
          adminDropdownClickedRef.current = false;
        }
      }}
      onClick={(e) => {
        if (adminDropdownClickedRef.current) {
          console.log(`[VideoCardHoverDebug ${video.id}] onClick - dropdown click detected (fallback), returning`);
          adminDropdownClickedRef.current = false; 
          return;
        }
        console.log(`[VideoCardHoverDebug ${video.id}] onClick - opening lightbox`);
        onOpenLightbox(video);
      }}
      data-hovering={combinedHovering ? "true" : "false"}
      data-video-id={video.id}
    >
      <div 
        ref={previewRef}
        className="w-full overflow-hidden bg-muted relative max-h-none"
        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16 / 9' }}
      >
        <div className="absolute inset-0 w-full h-full">
          <VideoPreview
            key={`video-${video.id}`}
            url={videoSourceUrl}
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

          {isMobile && (
            <div 
              className="absolute bottom-2 right-2 z-20 p-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none"
              title="Tap to expand"
            >
              <ArrowUpRight className="h-4 w-4 text-white/80" />
            </div>
          )}

          {isMobile && (video.metadata?.title || (!isProfilePage && creatorDisplayName) || (isProfilePage && shouldShowBadge)) && (
            <div className="absolute top-2 left-2 z-20 flex flex-col">
              <div className="bg-black/30 backdrop-blur-sm rounded-md p-1.5 pointer-events-none flex flex-col gap-1">
                {(video.metadata?.title || (isProfilePage && shouldShowBadge)) && (
                  <div className="flex items-center space-x-1">
                    {isProfilePage && shouldShowBadge && (
                      <img
                        src="/reward.png"
                        alt="Featured by OpenMuse"
                        title="Featured by OpenMuse"
                        className="h-6 w-6 flex-shrink-0"
                      />
                    )}
                    {video.metadata?.title && (
                      <span className="block text-white text-xs font-medium leading-snug">
                        {video.metadata.title}
                      </span>
                    )}
                  </div>
                )}
                {!isProfilePage && creatorDisplayName && (() => {
                  const titleOrBadgeExists = video.metadata?.title || (isProfilePage && shouldShowBadge);
                  return (
                    <span className={cn(
                      "flex items-center space-x-1",
                      titleOrBadgeExists && "mt-1"
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

          {!isMobile && shouldAlwaysShowInfo && !forceCreatorHoverDesktop && (video.metadata?.title || (!isProfilePage && creatorDisplayName) || (isProfilePage && shouldShowBadge)) && (
            <div className="absolute top-2 left-2 z-20 flex flex-col">
              <div className="bg-black/30 backdrop-blur-sm rounded-md p-1.5 pointer-events-none flex flex-col gap-1">
                {(video.metadata?.title || (isProfilePage && shouldShowBadge)) && (
                  <div className="flex items-center space-x-1">
                     {isProfilePage && shouldShowBadge && (
                      <img
                        src="/reward.png"
                        alt="Featured by OpenMuse"
                        title="Featured by OpenMuse"
                        className="h-5 w-5 flex-shrink-0"
                      />
                    )}
                    {video.metadata?.title && (
                      <span className="block text-white text-xs font-medium leading-snug">
                        {video.metadata.title}
                      </span>
                    )}
                  </div>
                )}
                {!isProfilePage && creatorDisplayName && (() => {
                  const titleOrBadgeExists = video.metadata?.title || (isProfilePage && shouldShowBadge);
                  return (
                    <span className={cn(
                      "flex items-center space-x-1",
                      titleOrBadgeExists && "mt-1"
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

          {isAuthorized && (isProfilePage || !(isAdmin && onAdminStatusChange)) && (
            <div className={cn(
              "absolute bottom-2 left-2 z-30 transition-opacity duration-200",
              !isMobile && "opacity-0 group-hover:opacity-100"
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

          {isAdmin && onAdminStatusChange && (
            <div 
              className="absolute bottom-2 left-2 z-40 admin-dropdown-blocker"
              style={isAuthorized && isProfilePage ? { transform: 'translateX(calc(100% + 8px))' } : {}}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span onMouseDown={(e) => {
                    console.log(`[VideoCardHoverDebug ${video.id}] Admin dropdown onMouseDown`);
                    adminDropdownClickedRef.current = true;
                    setTimeout(() => {
                      // Only clear if it hasn't been cleared by onClickCapture already
                      if (adminDropdownClickedRef.current) {
                         console.log(`[VideoCardHoverDebug ${video.id}] Admin dropdown timeout clearing flag`);
                         adminDropdownClickedRef.current = false;
                      }
                    }, 100); 
                  }}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-auto px-2 py-1 shadow-md bg-background/80 hover:bg-background/100 backdrop-blur-sm"
                      disabled={isChangingAdminStatus}
                    >
                      {isChangingAdminStatus ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        getAdminStatusIcon(video.admin_status)
                      )}
                      <span className="sr-only">Admin Status</span>
                    </Button>
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Change Admin Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {adminStatusOptions.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => handleVideoAdminStatusChange(status)}
                      disabled={isStatusEqual(video.admin_status, status) || isChangingAdminStatus}
                      className={isStatusEqual(video.admin_status, status) ? statusOptionColors[status] : ""}
                    >
                      {getAdminStatusIcon(status)}
                      <span>{status}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {isAuthorized && (
            <div 
              className={cn(
                "absolute top-2 right-2 z-50 flex gap-2",
                !isMobile && "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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
                    isActuallyPrimary && "text-yellow-400 hover:text-yellow-300"
                  )}
                  onClick={handleSetPrimary}
                  title={isActuallyPrimary ? "This is the primary media" : "Make primary video"}
                  disabled={isActuallyPrimary}
                >
                  <Star className={cn("h-4 w-4", isActuallyPrimary && "fill-current text-yellow-400")} />
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

          {!isMobile && (!shouldAlwaysShowInfo || forceCreatorHoverDesktop) && (video.metadata?.title || (!isProfilePage && creatorDisplayName) || (isProfilePage && shouldShowBadge)) && (
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
              <div className="absolute top-2 left-2 z-20 flex flex-col">
                <div className="bg-black/30 backdrop-blur-sm rounded-md p-1.5 pointer-events-none flex flex-col gap-1">
                  {(video.metadata?.title || (isProfilePage && shouldShowBadge)) && (
                    <div className="flex items-center space-x-1 pointer-events-auto">
                       {isProfilePage && shouldShowBadge && (
                        <img
                          src="/reward.png"
                          alt="Featured by OpenMuse"
                          title="Featured by OpenMuse"
                          className="h-5 w-5 flex-shrink-0"
                        />
                      )}
                      {video.metadata?.title && (
                        <span className="block text-white text-xs font-medium leading-snug">
                          {video.metadata.title}
                        </span>
                      )}
                    </div>
                  )}
                  {!isProfilePage && creatorDisplayName && (() => {
                    const titleOrBadgeExists = video.metadata?.title || (isProfilePage && shouldShowBadge);
                    return (
                      <span className={cn(
                        "flex items-center space-x-1 pointer-events-auto",
                        titleOrBadgeExists && "mt-1"
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

      {!isMobile && (
        <div 
          className={cn(
            "absolute bottom-2 right-2 z-20 p-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-300"
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

const areEqual = (prev: Readonly<VideoCardProps>, next: Readonly<VideoCardProps>) => {
  if (prev.isHovering !== next.isHovering) return false;
  if (prev.shouldBePlaying !== next.shouldBePlaying) return false;
  if (prev.isAdmin !== next.isAdmin) return false;
  if (prev.isAuthorized !== next.isAuthorized) return false;
  if (prev.alwaysShowInfo !== next.alwaysShowInfo) return false;
  if (prev.forceCreatorHoverDesktop !== next.forceCreatorHoverDesktop) return false;
  if (prev.video !== next.video) return false;
  if (prev.onAdminStatusChange !== next.onAdminStatusChange) return false;
  if (prev.onFormatUnsupportedOnMobile !== next.onFormatUnsupportedOnMobile) return false;
  return true;
};

const MemoizedVideoCard = memo(VideoCard, areEqual);
export default MemoizedVideoCard;
