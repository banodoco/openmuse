
import React, { useState } from 'react';
import { VideoEntry, AdminStatus } from '@/lib/types';
import VideoList from './VideoList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import VideoFilter from './VideoFilter';

interface VideoManagerProps {
  videos: VideoEntry[];
  isLoading: boolean;
  refetchVideos: () => void;
  deleteVideo: (id: string) => Promise<boolean>;
  approveVideo: (id: string) => Promise<VideoEntry | null>;
  listVideo?: (id: string) => Promise<VideoEntry | null>;
  rejectVideo: (id: string) => Promise<VideoEntry | null>;
}

const VideoManager: React.FC<VideoManagerProps> = ({
  videos,
  isLoading,
  refetchVideos,
  deleteVideo,
  approveVideo,
  listVideo,
  rejectVideo
}) => {
  const { user, isAdmin } = useAuth();
  const [videoFilter, setVideoFilter] = useState('curated');
  
  const sortedVideos = React.useMemo(() => {
    return [...videos].sort((a, b) => {
      const aPrimary = a.metadata?.isPrimary === true;
      const bPrimary = b.metadata?.isPrimary === true;
      
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return bDate - aDate;
    });
  }, [videos]);
  
  const filteredVideos = React.useMemo(() => {
    if (videoFilter === 'curated') {
      return sortedVideos.filter(video => video.admin_status === 'Curated');
    } else if (videoFilter === 'listed') {
      return sortedVideos.filter(video => video.admin_status === 'Listed');
    } else if (videoFilter === 'rejected') {
      return sortedVideos.filter(video => video.admin_status === 'Rejected' as AdminStatus);
    }
    return sortedVideos;
  }, [sortedVideos, videoFilter]);
  
  const curatedVideos = sortedVideos.filter(video => video.admin_status === 'Curated');
  const listedVideos = sortedVideos.filter(video => video.admin_status === 'Listed');
  const rejectedVideos = sortedVideos.filter(video => video.admin_status === ('Rejected' as AdminStatus));
  
  const handleDelete = async (id: string) => {
    try {
      await deleteVideo(id);
      refetchVideos();
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };
  
  const handleApprove = async (id: string) => {
    try {
      await approveVideo(id);
      refetchVideos();
    } catch (error) {
      console.error('Error approving video:', error);
    }
  };
  
  const handleList = async (id: string) => {
    try {
      if (listVideo) {
        await listVideo(id);
        refetchVideos();
      }
    } catch (error) {
      console.error('Error listing video:', error);
    }
  };
  
  const handleReject = async (id: string) => {
    try {
      await rejectVideo(id);
      refetchVideos();
    } catch (error) {
      console.error('Error rejecting video:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4 mt-8">
        <Skeleton className="h-10 w-[200px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="mt-8">
      <VideoFilter
        videoFilter={videoFilter}
        setVideoFilter={setVideoFilter}
        onRefresh={refetchVideos}
        isDisabled={isLoading}
        isAdmin={isAdmin}
      />
      
      <VideoList
        videos={filteredVideos}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onList={listVideo ? handleList : undefined}
        onReject={handleReject}
        refetchData={refetchVideos}
      />
    </div>
  );
};

export default VideoManager;
