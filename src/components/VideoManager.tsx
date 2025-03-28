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
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState(false);
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
      return sortedVideos.filter(video => video.admin_approved === 'Curated');
    } else if (videoFilter === 'listed') {
      return sortedVideos.filter(video => !video.admin_approved || video.admin_approved === 'Listed');
    } else if (videoFilter === 'rejected') {
      return sortedVideos.filter(video => video.admin_approved === 'Rejected');
    }
    return sortedVideos;
  }, [sortedVideos, videoFilter]);
  
  const curatedVideos = sortedVideos.filter(video => video.admin_approved === 'Curated');
  const listedVideos = sortedVideos.filter(video => !video.admin_approved || video.admin_approved === 'Listed');
  const rejectedVideos = sortedVideos.filter(video => video.admin_approved === 'Rejected');
  
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
  
  if (!isAdmin) {
    React.useEffect(() => {
      if (videoFilter === 'rejected' && !isAdmin) {
        setVideoFilter('curated');
      }
    }, [videoFilter, isAdmin]);
    
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
      
      <Tabs defaultValue="curated" className="mt-4">
        <TabsList className="mb-4">
          <TabsTrigger value="curated">
            Curated ({curatedVideos.length})
          </TabsTrigger>
          <TabsTrigger value="listed">
            Listed ({listedVideos.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedVideos.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="curated">
          <VideoList
            videos={curatedVideos}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onList={listVideo ? handleList : undefined}
            onReject={handleReject}
            refetchData={refetchVideos}
          />
        </TabsContent>
        
        <TabsContent value="listed">
          <VideoList
            videos={listedVideos}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onList={listVideo ? handleList : undefined}
            onReject={handleReject}
            refetchData={refetchVideos}
          />
        </TabsContent>
        
        <TabsContent value="rejected">
          <VideoList
            videos={rejectedVideos}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onList={listVideo ? handleList : undefined}
            onReject={handleReject}
            refetchData={refetchVideos}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VideoManager;
