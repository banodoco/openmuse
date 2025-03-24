import React, { useEffect, useState } from 'react';
import { VideoEntry } from '@/lib/types';
import VideoList from '@/components/VideoList';
import Navigation from '@/components/Navigation';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import { Button } from "@/components/ui/button";
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';

const logger = new Logger('Index');

const Index = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [videoFilter, setVideoFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userIsBusy, setUserIsBusy] = useState<boolean>(false);
  
  const { 
    videos, 
    isLoading: videosLoading, 
    refetchVideos,
    deleteVideo,
    approveVideo,
    rejectVideo
  } = useVideoManagement();
  
  useEffect(() => {
    const setupAuth = async () => {
      try {
        logger.log('Index: Setting up auth listeners');
        
        setIsLoading(true);
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          logger.log('Index: Auth state changed:', event);
          
          if (event === 'SIGNED_OUT') {
            logger.log('Index: User signed out, redirecting to auth');
            navigate('/auth');
          }
        });
        
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Index: Error checking session:', error);
          throw error;
        }
        
        logger.log('Index: Session check complete, has session:', !!data.session);
        
        setIsLoading(false);
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        logger.error('Index: Error in auth setup:', error);
        setIsLoading(false);
        toast.error('Failed to check authentication status');
      }
    };
    
    setupAuth();
  }, [navigate]);
  
  const handleDeleteVideo = async (id: string) => {
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
  };
  
  const handleApproveVideo = async (id: string) => {
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
  };
  
  const handleRejectVideo = async (id: string) => {
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
  };
  
  const shouldShowLoading = isLoading || videosLoading;
  
  const shouldShowEmpty = !shouldShowLoading && (!videos || videos.length === 0);
  
  const handleNavigateToUpload = () => {
    navigate('/upload');
  };
  
  const filteredVideos = videoFilter === "all" 
    ? videos 
    : videoFilter === "approved" 
      ? videos?.filter(v => v.admin_approved) 
      : videos?.filter(v => !v.admin_approved && !v.skipped);
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <main className="flex-1 container mx-auto p-4">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Video Responses</h1>
            <p className="text-muted-foreground mt-1">
              View and manage video responses from your platform
            </p>
          </div>
          
          <Button 
            onClick={handleNavigateToUpload}
            size={isMobile ? "sm" : "default"}
            disabled={userIsBusy}
          >
            Record New Video
          </Button>
        </div>
        
        {shouldShowLoading && <LoadingState text="Loading videos..." />}
        
        {shouldShowEmpty && (
          <EmptyState 
            title="No videos yet" 
            description="Get started by recording your first video response." 
            showSignIn={false}
          />
        )}
        
        {!shouldShowLoading && !shouldShowEmpty && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <select 
                className="p-2 border rounded-md bg-background"
                value={videoFilter}
                onChange={(e) => setVideoFilter(e.target.value)}
              >
                <option value="all">All Videos</option>
                <option value="approved">Approved Videos</option>
                <option value="pending">Pending Videos</option>
              </select>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refetchVideos}
                disabled={userIsBusy}
              >
                Refresh
              </Button>
            </div>
            
            <VideoList 
              videos={filteredVideos || []} 
              onDelete={handleDeleteVideo}
              onApprove={handleApproveVideo}
              onReject={handleRejectVideo}
              refetchData={refetchVideos}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
