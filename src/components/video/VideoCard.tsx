import React, { useState, memo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Check, X, Play } from 'lucide-react';
import StorageVideoPlayer from '../StorageVideoPlayer';
import { VideoEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import VideoPreview from '../VideoPreview';

interface VideoCardProps {
  video: VideoEntry;
  isAdmin: boolean;
  onOpenLightbox: (video: VideoEntry) => void;
  onApproveVideo?: (videoId: string) => void;
  onDeleteVideo?: (videoId: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = memo(({
  video,
  isAdmin,
  onOpenLightbox,
  onApproveVideo,
  onDeleteVideo
}) => {
  const { user } = useAuth();
  const [isHovering, setIsHovering] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
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
      setThumbnailUrl(video.metadata.thumbnailUrl);
    }
    
    fetchCreatorProfile();
  }, [video.user_id, video.metadata]);
  
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
  
  return (
    <div 
      key={video.id} 
      className="relative rounded-lg overflow-hidden shadow-md group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => onOpenLightbox(video)}
    >
      <div className="aspect-video">
        <div className="w-full h-full">
          <div className="w-full h-full relative">
            <VideoPreview
              key={`video-${video.id}`}
              url={video.video_location}
              title={video.metadata?.title || `Video by ${getCreatorName()}`}
              creator={getCreatorName()}
              className="w-full h-full object-cover"
              isHovering={isHovering}
              lazyLoad={true}
              thumbnailUrl={thumbnailUrl}
            />
            
            <div 
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 
                ${isHovering 
                  ? 'opacity-100' 
                  : 'opacity-0'
                }`}
            >
              <div className="bg-white/5 rounded-full p-2 backdrop-blur-sm">
                <Play className="h-6 w-6 text-white/30 group-hover:text-white/50 transition-colors" />
              </div>
            </div>
          </div>
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
});

VideoCard.displayName = 'VideoCard';

export default VideoCard;
