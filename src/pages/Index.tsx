
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import ConsentDialog from '@/components/ConsentDialog';
import { UploadCloud } from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import { getCurrentUserProfile } from '@/lib/auth';

// Import our new components
import VideoList from '@/components/VideoList';
import VideoViewer from '@/components/VideoViewer';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import RecorderWrapper from '@/components/RecorderWrapper';
import { useVideoManagement } from '@/hooks/useVideoManagement';

const Index: React.FC = () => {
  const {
    videos,
    currentVideo,
    isLoading,
    isRecording,
    noVideosAvailable,
    handleSelectVideo,
    handleSkip,
    handleStartRecording,
    handleVideoRecorded,
    handleCancelRecording,
    handleVideoLoaded
  } = useVideoManagement();

  const [userProfile, setUserProfile] = useState<{ id: string, username: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (profile) {
          setUserProfile({
            id: profile.id,
            username: profile.username
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };
    
    loadUserProfile();
  }, []);

  return (
    <RequireAuth allowUnauthenticated={true}>
      <div className="min-h-screen flex flex-col bg-background animate-fade-in">
        <Navigation />
        <ConsentDialog />
        
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-3xl font-bold text-center mb-4">Evaluate videos now</h1>
            <p className="text-muted-foreground text-center max-w-2xl">
              Watch videos and record your responses. Help others by providing feedback.
            </p>
          </div>
          
          {userProfile && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">Signed in as <span className="font-medium">{userProfile.username}</span></p>
            </div>
          )}

          <div className="mb-6">
            <Button 
              onClick={() => navigate('/upload')} 
              variant="outline"
              className="rounded-full gap-2"
            >
              <UploadCloud className="h-4 w-4" />
              Upload Videos
            </Button>
          </div>
          
          {isLoading ? (
            <LoadingState />
          ) : !userProfile ? (
            <EmptyState 
              title="Sign in to evaluate videos"
              description="Please sign in with Discord to start evaluating videos and providing feedback."
            />
          ) : noVideosAvailable ? (
            <EmptyState 
              title="No videos to respond to"
              description="There are no videos available for you to respond to at the moment."
            />
          ) : isRecording && currentVideo ? (
            <RecorderWrapper
              video={currentVideo}
              onVideoRecorded={handleVideoRecorded}
              onCancel={handleCancelRecording}
              onSkip={handleSkip}
            />
          ) : currentVideo ? (
            <VideoViewer
              video={currentVideo}
              onSkip={handleSkip}
              onStartRecording={handleStartRecording}
              onVideoLoaded={handleVideoLoaded}
            />
          ) : (
            <VideoList 
              videos={videos} 
              onSelectVideo={handleSelectVideo} 
            />
          )}
        </main>
      </div>
    </RequireAuth>
  );
};

export default Index;
