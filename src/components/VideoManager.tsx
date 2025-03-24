
import React, { useState, useCallback } from 'react';
import { VideoEntry } from '@/lib/types';
import VideoList from '@/components/VideoList';
import VideoFilter from '@/components/VideoFilter';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoManager');

interface VideoManagerProps {
  videos: VideoEntry[] | undefined;
  isLoading: boolean;
  refetchVideos: () => void;
  deleteVideo: (id: string) => Promise<boolean>;
  approveVideo: (id: string) => Promise<VideoEntry | null>;
  rejectVideo: (id: string) => Promise<VideoEntry | null>;
}

const VideoManager: React.FC<VideoManagerProps> = ({
  videos,
  isLoading,
  refetchVideos,
  deleteVideo,
  approveVideo,
  rejectVideo
}) => {
  const [videoFilter, setVideoFilter] = useState<string>("all");
  const [userIsBusy, setUserIsBusy] = useState<boolean>(false);
  
  const handleDeleteVideo = useCallback(async (id: string) => {
    try {
      setUserIsBusy(true);
      await deleteVideo(id);
      toast.success('Video deleted successfully');
    } catch (error) {
      logger.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    } finally {
      setUserIsBusy(false);
    }
  }, [deleteVideo]);
  
  const handleApproveVideo = useCallback(async (id: string) => {
    try {
      setUserIsBusy(true);
      await approveVideo(id);
      toast.success('Video approved successfully');
    } catch (error) {
      logger.error('Error approving video:', error);
      toast.error('Failed to approve video');
    } finally {
      setUserIsBusy(false);
    }
  }, [approveVideo]);
  
  const handleRejectVideo = useCallback(async (id: string) => {
    try {
      setUserIsBusy(true);
      await rejectVideo(id);
      toast.success('Video rejected successfully');
    } catch (error) {
      logger.error('Error rejecting video:', error);
      toast.error('Failed to reject video');
    } finally {
      setUserIsBusy(false);
    }
  }, [rejectVideo]);
  
  if (isLoading) {
    return <LoadingState text="Loading videos..." />;
  }
  
  const shouldShowEmpty = !videos || videos.length === 0;
  
  if (shouldShowEmpty) {
    return (
      <EmptyState 
        title="No videos yet" 
        description="Get started by recording your first video response." 
        showSignIn={false}
      />
    );
  }
  
  const filteredVideos = videoFilter === "all" 
    ? videos 
    : videoFilter === "approved" 
      ? videos.filter(v => v.admin_approved) 
      : videos.filter(v => !v.admin_approved && !v.skipped);
  
  return (
    <>
      <VideoFilter 
        videoFilter={videoFilter}
        setVideoFilter={setVideoFilter}
        onRefresh={refetchVideos}
        isDisabled={userIsBusy}
      />
      
      <VideoList 
        videos={filteredVideos} 
        onDelete={handleDeleteVideo}
        onApprove={handleApproveVideo}
        onReject={handleRejectVideo}
        refetchData={refetchVideos}
      />
    </>
  );
};

export default VideoManager;
