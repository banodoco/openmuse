import React, { useState } from 'react';
import { VideoEntry } from '@/lib/types';
import VideoList from './VideoList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { checkIsAdmin } from '@/lib/auth';
import VideoFilter from './VideoFilter';

interface VideoManagerProps {
  videos: VideoEntry[];
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
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [videoFilter, setVideoFilter] = useState('approved');
  
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
    if (videoFilter === 'all') {
      return sortedVideos;
    } else if (videoFilter === 'approved') {
      return sortedVideos.filter(video => video.admin_approved === true);
    } else if (videoFilter === 'pending') {
      return sortedVideos.filter(video => video.admin_approved === null);
    } else if (videoFilter === 'rejected') {
      return sortedVideos.filter(video => video.admin_approved === false);
    }
    return sortedVideos;
  }, [sortedVideos, videoFilter]);
  
  const approvedVideos = sortedVideos.filter(video => video.admin_approved === true);
  const pendingVideos = sortedVideos.filter(video => video.admin_approved === null);
  const rejectedVideos = sortedVideos.filter(video => video.admin_approved === false);
  
  React.useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.id) {
        const adminStatus = await checkIsAdmin(user.id);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [user]);
  
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
  
  if (!isAdmin) {
    return (
      <div className="mt-8">
        <VideoFilter
          videoFilter={videoFilter}
          setVideoFilter={setVideoFilter}
          onRefresh={refetchVideos}
          isDisabled={isLoading}
        />
        <VideoList
          videos={filteredVideos}
          onDelete={handleDelete}
          onApprove={handleApprove}
          onReject={handleReject}
          refetchData={refetchVideos}
        />
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
      />
      
      <Tabs defaultValue="approved" className="mt-4">
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            All ({videos.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Curated ({approvedVideos.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingVideos.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedVideos.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <VideoList
            videos={filteredVideos}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onReject={handleReject}
            refetchData={refetchVideos}
          />
        </TabsContent>
        
        <TabsContent value="approved">
          <VideoList
            videos={approvedVideos}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onReject={handleReject}
            refetchData={refetchVideos}
          />
        </TabsContent>
        
        <TabsContent value="pending">
          <VideoList
            videos={pendingVideos}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onReject={handleReject}
            refetchData={refetchVideos}
          />
        </TabsContent>
        
        <TabsContent value="rejected">
          <VideoList
            videos={rejectedVideos}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onReject={handleReject}
            refetchData={refetchVideos}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VideoManager;
