
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import ConsentDialog from '@/components/ConsentDialog';
import { UploadCloud, Paintbrush, Layers, Sparkles } from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import { getCurrentUserProfile } from '@/lib/auth';
import { Separator } from '@/components/ui/separator';

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
    console.log("Index: Current video state:", currentVideo ? `Video ${currentVideo.id}` : "No video selected");
    console.log("Index: Videos available:", videos.length);
    console.log("Index: Component states - isLoading:", isLoading, "isRecording:", isRecording, "noVideosAvailable:", noVideosAvailable);
  }, [videos, currentVideo, isLoading, isRecording, noVideosAvailable]);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (profile) {
          console.log("Index: User profile loaded:", profile.username);
          setUserProfile({
            id: profile.id,
            username: profile.username
          });
        } else {
          console.log("Index: No user profile loaded");
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };
    
    loadUserProfile();
  }, []);

  // Check which section is going to be rendered
  useEffect(() => {
    if (isLoading) {
      console.log("Index: Rendering loading state");
    } else if (noVideosAvailable) {
      console.log("Index: Rendering empty state (no videos)");
    } else if (isRecording && currentVideo) {
      console.log("Index: Rendering recorder");
    } else if (currentVideo) {
      console.log("Index: Rendering current video viewer");
    } else {
      console.log("Index: Rendering video list");
    }
  }, [isLoading, noVideosAvailable, isRecording, currentVideo]);

  return (
    <RequireAuth allowUnauthenticated={true}>
      <div className="min-h-screen flex flex-col bg-background animate-fade-in">
        <Navigation />
        <ConsentDialog />
        
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <div className="flex flex-col items-start mb-8">
            <h1 className="text-3xl font-bold text-left mb-4 w-full">Curated LoRAs for open video models</h1>
            <p className="text-muted-foreground text-left max-w-2xl w-full">
              Curated resources for unlocking the artistic potential of open video models like Wan, Hunyuan and LTXV
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
          
          {/* Art Section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center">
                <Paintbrush className="h-5 w-5 mr-2" />
                Art
              </h2>
              <Button variant="outline" className="gap-2">
                View All
              </Button>
            </div>
            
            <EmptyState 
              title="No art videos available"
              description="There are no art videos available at the moment. Upload some by clicking the 'Upload Videos' button above."
            />
          </div>
          
          <Separator className="my-8" />
          
          {/* LoRAs Section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center">
                <Layers className="h-5 w-5 mr-2" />
                LoRAs
              </h2>
              <Button variant="outline" className="gap-2">
                View All
              </Button>
            </div>
            
            <EmptyState 
              title="No LoRA videos available"
              description="There are no LoRA videos available at the moment. Upload some by clicking the 'Upload Videos' button above."
            />
          </div>
          
          <Separator className="my-8" />
          
          {/* Generations Section - This is the converted "Available Videos" section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center">
                <Sparkles className="h-5 w-5 mr-2" />
                Generations
              </h2>
              <Button variant="outline" className="gap-2">
                View All
              </Button>
            </div>
            
            {isLoading ? (
              <LoadingState />
            ) : noVideosAvailable ? (
              <EmptyState 
                title="No generation videos available"
                description="There are no generation videos available at the moment. Upload some by clicking the 'Upload Videos' button above."
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
                onStartRecording={!userProfile ? 
                  () => navigate('/auth?returnUrl=/') : 
                  handleStartRecording}
                onVideoLoaded={handleVideoLoaded}
              />
            ) : (
              <VideoList 
                videos={videos} 
                onSelectVideo={!userProfile ? 
                  () => navigate('/auth?returnUrl=/') : 
                  handleSelectVideo} 
              />
            )}
          </div>
        </main>
      </div>
    </RequireAuth>
  );
};

export default Index;
