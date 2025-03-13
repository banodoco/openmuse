import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { VideoEntry, RecordedVideo } from '@/lib/types';
import VideoPlayer from '@/components/VideoPlayer';
import WebcamRecorder from '@/components/WebcamRecorder';
import Navigation from '@/components/Navigation';
import { toast } from 'sonner';
import { VideoIcon, SkipForward, Loader2, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import RequireAuth from '@/components/RequireAuth';
import { getCurrentUserProfile } from '@/lib/auth';

const Index: React.FC = () => {
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

  const loadRandomVideo = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const db = await databaseSwitcher.getDatabase();
      const video = await db.getRandomPendingEntry();
      
      if (!video) {
        setNoVideosAvailable(true);
        setIsLoading(false);
        return;
      }
      
      console.log("Loading video:", video.video_location, "Uploaded by:", video.reviewer_name);
      
      if (video.video_location.startsWith('blob:')) {
        try {
          const response = await fetch(video.video_location);
          if (!response.ok) {
            console.error("Blob URL is no longer valid:", video.video_location);
            toast.error("Video is no longer accessible. Trying another...");
            
            await db.markAsSkipped(video.id);
            
            loadRandomVideo();
            return;
          }
          
          setCurrentVideo(video);
          setNoVideosAvailable(false);
          setIsLoading(false);
        } catch (err) {
          console.error("Error checking blob URL:", err);
          toast.error("Video couldn't be accessed. Trying another...");
          
          await db.markAsSkipped(video.id);
          
          loadRandomVideo();
        }
      } else {
        setCurrentVideo(video);
        setNoVideosAvailable(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error loading video:", error);
      toast.error("Error loading video. Please try again.");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRandomVideo();
  }, [loadRandomVideo]);

  const handleSkip = useCallback(async () => {
    if (currentVideo) {
      const db = await databaseSwitcher.getDatabase();
      await db.markAsSkipped(currentVideo.id);
      toast.info('Video skipped. Loading another video...');
      loadRandomVideo();
    }
  }, [currentVideo, loadRandomVideo]);

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
      loadRandomVideo();
    } catch (error) {
      console.error('Error saving video response:', error);
      toast.error('Failed to save your response. Please try again.');
    }
  }, [currentVideo, loadRandomVideo]);

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
        
        <main className="flex-1 container max-w-5xl py-8 px-4">
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
          ) : null}
        </main>
      </div>
    </RequireAuth>
  );
};

export default Index;
