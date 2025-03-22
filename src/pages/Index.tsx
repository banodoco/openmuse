
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { VideoEntry, RecordedVideo } from '@/lib/types';
import VideoPlayer from '@/components/VideoPlayer';
import WebcamRecorder from '@/components/WebcamRecorder';
import Navigation from '@/components/Navigation';
import ConsentDialog from '@/components/ConsentDialog';
import { toast } from 'sonner';
import { VideoIcon, SkipForward, Loader2, UploadCloud, Grid2X2, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import RequireAuth from '@/components/RequireAuth';
import { getCurrentUserProfile } from '@/lib/auth';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

const Index: React.FC = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [noVideosAvailable, setNoVideosAvailable] = useState(false);
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

  const loadAllPendingVideos = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const db = await databaseSwitcher.getDatabase();
      const allEntries = await db.getAllEntries();
      
      // Filter for pending entries (no acting video and not skipped)
      const pendingEntries = allEntries.filter(
        entry => !entry.acting_video_location && !entry.skipped
      );
      
      setVideos(pendingEntries);
      
      if (pendingEntries.length === 0) {
        setNoVideosAvailable(true);
      } else {
        setNoVideosAvailable(false);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading videos:", error);
      toast.error("Error loading videos. Please try again.");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllPendingVideos();
  }, [loadAllPendingVideos]);

  const handleSelectVideo = (video: VideoEntry) => {
    setCurrentVideo(video);
    setIsRecording(false);
  };

  const handleSkip = useCallback(async () => {
    if (currentVideo) {
      const db = await databaseSwitcher.getDatabase();
      await db.markAsSkipped(currentVideo.id);
      toast.info('Video skipped. Loading another video...');
      setCurrentVideo(null);
      loadAllPendingVideos();
    }
  }, [currentVideo, loadAllPendingVideos]);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true);
  }, []);

  const handleVideoRecorded = useCallback(async (recordedVideo: RecordedVideo) => {
    if (!currentVideo) return;
    
    console.log('Video recorded, blob size:', recordedVideo.blob.size, 'URL:', recordedVideo.url);
    
    try {
      const db = await databaseSwitcher.getDatabase();
      await db.saveActingVideo(currentVideo.id, recordedVideo.url);
      
      toast.success('Your response has been saved!');
      setIsRecording(false);
      setCurrentVideo(null);
      loadAllPendingVideos();
    } catch (error) {
      console.error('Error saving video response:', error);
      toast.error('Failed to save your response. Please try again.');
    }
  }, [currentVideo, loadAllPendingVideos]);

  const handleCancelRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const handleVideoLoaded = useCallback(() => {
    console.log("Video fully loaded and ready to play");
  }, []);

  return (
    <RequireAuth>
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
            <div className="h-96 flex items-center justify-center animate-pulse-opacity">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
          ) : noVideosAvailable ? (
            <div className="h-96 flex flex-col items-center justify-center text-center animate-slide-in">
              <VideoIcon className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h2 className="text-2xl font-bold mb-2">No videos to respond to</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                There are no videos available for you to respond to at the moment.
              </p>
            </div>
          ) : isRecording && currentVideo ? (
            <div className="animate-scale-in">
              <h2 className="text-2xl font-bold mb-6">Record Your Response</h2>
              <div className="bg-card shadow-subtle rounded-xl overflow-hidden">
                <WebcamRecorder
                  onVideoRecorded={handleVideoRecorded}
                  onCancel={handleCancelRecording}
                  onSkip={handleSkip}
                  className="p-6"
                  sourceSrc={currentVideo.video_location}
                />
              </div>
            </div>
          ) : currentVideo ? (
            <div className="animate-slide-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Uploaded by {currentVideo.reviewer_name}
                  </span>
                  <h2 className="text-2xl font-bold">Watch and Respond</h2>
                </div>
                
                <div className="flex space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={handleSkip}
                    className="gap-2 rounded-full"
                  >
                    <SkipForward className="h-4 w-4" />
                    Skip This Video
                  </Button>
                  <Button 
                    onClick={handleStartRecording}
                    className={cn(
                      "gap-2 rounded-full transition-all duration-300",
                      "hover:bg-primary/90 hover:scale-[1.02]"
                    )}
                  >
                    <VideoIcon className="h-4 w-4" />
                    Record Response
                  </Button>
                </div>
              </div>
              
              <div className="bg-card shadow-subtle rounded-xl overflow-hidden p-6">
                <div className="aspect-video w-full max-h-[70vh] rounded-lg overflow-hidden">
                  <VideoPlayer 
                    src={currentVideo.video_location} 
                    controls
                    autoPlay
                    onLoadedData={handleVideoLoaded}
                    muted={false}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Available Videos</h2>
                <Button variant="outline" className="gap-2">
                  <Grid2X2 className="h-4 w-4" />
                  {videos.length} Videos
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <Card key={video.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-video overflow-hidden bg-black">
                      <VideoPlayer
                        src={video.video_location}
                        controls
                        muted
                        className="w-full h-full"
                      />
                    </div>
                    <CardContent className="pt-4">
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                          <VideoIcon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{video.reviewer_name}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-4">
                      <Button 
                        onClick={() => handleSelectVideo(video)} 
                        className="w-full gap-2"
                      >
                        <MessageSquareText className="h-4 w-4" />
                        Respond
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </RequireAuth>
  );
};

export default Index;
