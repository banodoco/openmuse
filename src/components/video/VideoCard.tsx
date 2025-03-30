
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { VideoEntry } from '@/lib/types';
import { Logger } from '@/lib/logger';
import VideoCardMedia from './card/VideoCardMedia';
import VideoCardInfo from './card/VideoCardInfo';
import VideoCardAdmin from './card/VideoCardAdmin';
import { useVideoCreator } from './card/useVideoCreator';

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
  showPlayButton?: boolean;
  forceFrameCapture?: boolean;
  captureTimeout?: number;
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
  isMobile = false,
  showPlayButton = true,
  forceFrameCapture = false,
  captureTimeout = 5000
}) => {
  const { getCreatorName } = useVideoCreator(video);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHoveringRef = useRef(isHovering);
  
  useEffect(() => {
    isHoveringRef.current = isHovering;
    logger.log(`VideoCard: isHovering prop changed for ${video.id}: ${isHovering}`);
  }, [isHovering, video.id]);
  
  useEffect(() => {
    // Set thumbnail from metadata if available
    if (video.metadata?.thumbnailUrl) {
      logger.log(`VideoCard: Using thumbnail from metadata for ${video.id}: ${video.metadata.thumbnailUrl.substring(0, 30)}...`);
      setThumbnailUrl(video.metadata.thumbnailUrl);
    } else {
      logger.log(`VideoCard: No thumbnail in metadata for ${video.id}, will generate from video`);
    }
  }, [video.metadata, video.id]);
  
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
    } else {
      onOpenLightbox(video);
    }
  };
  
  const creatorName = getCreatorName();
  const videoTitle = video.metadata?.title || `Video by ${creatorName}`;
  
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
      <VideoCardMedia 
        video={video}
        isHovering={isHovering}
        thumbnailUrl={thumbnailUrl}
        creatorName={creatorName}
        onTouch={handleTouch}
        isMobile={isMobile}
        showPlayButton={showPlayButton}
        forceFrameCapture={forceFrameCapture}
        captureTimeout={captureTimeout}
      />
      
      <VideoCardInfo 
        title={videoTitle}
        creatorName={creatorName}
      />
      
      {isAdmin && (
        <VideoCardAdmin 
          adminApproved={video.admin_approved}
          onApprove={handleApprove}
          onList={handleList}
          onReject={handleReject}
        />
      )}
    </div>
  );
};

VideoCard.displayName = 'VideoCard';

export default VideoCard;
