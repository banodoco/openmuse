import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Check, X, Play } from 'lucide-react';
import { VideoEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import VideoPreview from '../VideoPreview';
import { Logger } from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';

const logger = new Logger('VideoCard');

interface VideoCardProps {
  video: VideoEntry;
  isAdmin: boolean;
  onOpenLightbox: (video: VideoEntry) => void;
  onApproveVideo?: (videoId: string) => void;
  onDeleteVideo?: (videoId: string) => void;
  isHovering?: boolean;
  onHoverChange?: (isHovering: boolean) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isAdmin,
  onOpenLightbox,
  onApproveVideo,
  onDeleteVideo,
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
  const [shouldAttemptGeneration, setShouldAttemptGeneration] = useState(false);
  
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
      const initialUrl = video.metadata.thumbnailUrl;
      setThumbnailUrl(initialUrl);
      if (initialUrl === 'FAILED_GENERATION') {
        setShouldAttemptGeneration(true);
        logger.log(`VideoCard: Initial state for ${video.id} is FAILED_GENERATION, will attempt generation.`);
      } else {
        setShouldAttemptGeneration(false);
      }
    } else {
      setThumbnailUrl(null);
      setShouldAttemptGeneration(false);
      logger.log(`VideoCard: Initial state for ${video.id} has no thumbnailUrl, generation will not be attempted.`);
    }
    
    fetchCreatorProfile();
  }, [video.id, video.user_id, video.metadata]);
  
  const handleThumbnailUpdate = async (result: { success: true; url: string } | { success: false }) => {
    if (!video.id) {
      logger.error('VideoCard: Cannot update thumbnail, video ID is missing.');
      return;
    }

    const valueToSave = result.success ? result.url : 'FAILED_GENERATION';
    logger.log(`VideoCard: Handling thumbnail update for video ${video.id}. Result: ${result.success ? 'Success' : 'Failure'}. Value to save: ${valueToSave}`);

    try {
      const { data: currentMedia, error: fetchError } = await supabase
        .from('media')
        .select('metadata')
        .eq('id', video.id)
        .maybeSingle();

      if (fetchError) {
        logger.error(`VideoCard: Error fetching current metadata for video ${video.id}:`, fetchError);
        return;
      }

      const currentMetadata = currentMedia?.metadata || {};
      if (currentMetadata.thumbnailUrl === valueToSave) {
        logger.log(`VideoCard: Thumbnail URL for video ${video.id} is already ${valueToSave}. Skipping DB update.`);
        return;
      }

      const newMetadata = {
        ...currentMetadata,
        thumbnailUrl: valueToSave
      };

      const { error: updateError } = await supabase
        .from('media')
        .update({ metadata: newMetadata })
        .eq('id', video.id);

      if (updateError) {
        logger.error(`VideoCard: Error updating thumbnail URL in DB for video ${video.id}:`, updateError);
      } else {
        logger.log(`VideoCard: Successfully updated thumbnail URL in DB for video ${video.id} to ${valueToSave}`);
        setThumbnailUrl(valueToSave);
        if (!result.success) {
          setShouldAttemptGeneration(false);
        }
      }
    } catch (error) {
      logger.error(`VideoCard: Unexpected error updating thumbnail in DB for video ${video.id}:`, error);
    }
  };
  
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
  
  const isProfilePage = location.pathname.includes('/profile/');
  
  logger.log(`VideoCard rendering for ${video.id}, isHovering: ${isHovering}`);
  
  return (
    <div 
      ref={cardRef}
      key={video.id} 
      className="relative z-10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col bg-white/5 backdrop-blur-sm border border-white/10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onOpenLightbox(video)}
      data-hovering={isHovering ? "true" : "false"}
      data-video-id={video.id}
    >
      <div 
        className="w-full overflow-hidden bg-muted relative max-h-[75vh]"
        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16/9' }}
      >
        <div className="absolute inset-0 w-full h-full">
          <VideoPreview
            key={`video-${video.id}`}
            url={video.video_location}
            title={video.metadata?.title || `Video by ${getCreatorName()}`}
            creator={getCreatorName()}
            className="w-full h-full object-cover"
            isHovering={isHovering}
            lazyLoad={false}
            thumbnailUrl={thumbnailUrl === 'FAILED_GENERATION' ? null : thumbnailUrl}
            forceGenerate={shouldAttemptGeneration}
            onLoadedData={handleVideoLoad}
            onThumbnailSuccess={(url) => handleThumbnailUpdate({ success: true, url })}
            onThumbnailFailure={() => handleThumbnailUpdate({ success: false })}
          />
          
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
        </div>
      </div>
      
      <div className="bg-gradient-to-b from-card to-card/70 flex-grow flex flex-col backdrop-blur-sm">
        {video.metadata?.title ? (
          <h3 className="px-2 pt-2 font-medium text-sm truncate">
            {video.metadata.title}
          </h3>
        ) : null}
        
        {!isProfilePage && video.user_id && (
            <p className="px-2 pb-2 text-xs text-muted-foreground truncate">By: {getCreatorName()}</p>
        )}
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
