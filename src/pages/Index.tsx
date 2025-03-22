
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import ConsentDialog from '@/components/ConsentDialog';
import { UploadCloud, Paintbrush, Layers, Sparkles } from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import { getCurrentUserProfile } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
          <div className="flex flex-col items-start mb-8">
            <h1 className="text-3xl font-bold text-left mb-4 w-full">Resources for open video models</h1>
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
          
          <Tabs defaultValue="art" className="w-full mb-8">
            <TabsList className="mb-6">
              <TabsTrigger value="art" className="gap-2">
                <Paintbrush className="h-4 w-4" />
                Art
              </TabsTrigger>
              <TabsTrigger value="loras" className="gap-2">
                <Layers className="h-4 w-4" />
                LoRAs
              </TabsTrigger>
              <TabsTrigger value="generations" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generations
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="art" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-semibold mb-2">Video Art Fundamentals</h3>
                  <p className="text-muted-foreground mb-4">Learn the basics of creating compelling video art with AI models</p>
                  <div className="h-40 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-md mb-4"></div>
                  <Button variant="outline" className="w-full">Explore</Button>
                </div>
                <div className="bg-card rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-semibold mb-2">Creative Techniques</h3>
                  <p className="text-muted-foreground mb-4">Advanced methods for unique video art creation</p>
                  <div className="h-40 bg-gradient-to-r from-purple-500 to-blue-500 rounded-md mb-4"></div>
                  <Button variant="outline" className="w-full">Learn More</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="loras" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-semibold mb-2">Custom LoRAs</h3>
                  <p className="text-muted-foreground mb-4">Create personalized video models with custom training</p>
                  <div className="h-32 bg-gradient-to-r from-green-400 to-teal-500 rounded-md mb-4"></div>
                  <Button variant="outline" className="w-full">Get Started</Button>
                </div>
                <div className="bg-card rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-semibold mb-2">LoRA Library</h3>
                  <p className="text-muted-foreground mb-4">Explore pre-trained models for various styles</p>
                  <div className="h-32 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-md mb-4"></div>
                  <Button variant="outline" className="w-full">Browse</Button>
                </div>
                <div className="bg-card rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-semibold mb-2">Training Guide</h3>
                  <p className="text-muted-foreground mb-4">Learn how to train effective LoRAs</p>
                  <div className="h-32 bg-gradient-to-r from-orange-400 to-red-500 rounded-md mb-4"></div>
                  <Button variant="outline" className="w-full">Read Guide</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="generations" className="space-y-4">
              <div className="p-6 bg-card rounded-lg border border-border">
                <h3 className="text-xl font-semibold mb-4">Latest Generations</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-md overflow-hidden bg-muted aspect-video hover:opacity-90 transition-opacity cursor-pointer">
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500"></div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-center">
                  <Button>View All Generations</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          {isLoading ? (
            <LoadingState />
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
        </main>
      </div>
    </RequireAuth>
  );
};

export default Index;
