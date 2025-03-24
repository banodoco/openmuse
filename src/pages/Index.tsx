
import React, { useState, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import AuthProvider from '@/components/AuthProvider';
import VideoManager from '@/components/VideoManager';
import PageHeader from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';

const logger = new Logger('Index');

const Index = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  
  const { 
    videos, 
    isLoading: videosLoading, 
    refetchVideos,
    deleteVideo,
    approveVideo,
    rejectVideo
  } = useVideoManagement();
  
  const handleNavigateToUpload = useCallback(() => {
    navigate('/upload');
  }, [navigate]);
  
  const handleAuthStateChange = useCallback((isLoading: boolean) => {
    setIsAuthLoading(isLoading);
  }, []);
  
  const isLoading = isAuthLoading || videosLoading;
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <AuthProvider onAuthStateChange={handleAuthStateChange}>
        <main className="flex-1 container mx-auto p-4">
          <PageHeader 
            title="Video Responses"
            description="View and manage video responses from your platform"
            buttonText="Record New Video"
            onButtonClick={handleNavigateToUpload}
            buttonSize={isMobile ? "sm" : "default"}
            buttonDisabled={isLoading}
          />
          
          <VideoManager 
            videos={videos}
            isLoading={isLoading}
            refetchVideos={refetchVideos}
            deleteVideo={deleteVideo}
            approveVideo={approveVideo}
            rejectVideo={rejectVideo}
          />
        </main>
      </AuthProvider>
    </div>
  );
};

export default Index;
