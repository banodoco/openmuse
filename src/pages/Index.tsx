
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { videoDB } from '@/lib/db';
import { VideoEntry, RecordedVideo } from '@/lib/types';
import VideoPlayer from '@/components/VideoPlayer';
import WebcamRecorder from '@/components/WebcamRecorder';
import Navigation from '@/components/Navigation';
import { toast } from 'sonner';
import { VideoIcon, SkipForward, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const Index: React.FC = () => {
  const [currentVideo, setCurrentVideo] = useState<VideoEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [noVideosAvailable, setNoVideosAvailable] = useState(false);
  const navigate = useNavigate();

  const loadRandomVideo = useCallback(async () => {
    setIsLoading(true);
    
    // Add a small delay to make transitions feel more natural
    setTimeout(() => {
      const video = videoDB.getRandomPendingEntry();
      
      if (!video) {
        setNoVideosAvailable(true);
      } else {
        setCurrentVideo(video);
        setNoVideosAvailable(false);
      }
      
      setIsLoading(false);
    }, 600);
  }, []);

  useEffect(() => {
    loadRandomVideo();
  }, [loadRandomVideo]);

  const handleSkip = useCallback(() => {
    if (currentVideo) {
      videoDB.markAsSkipped(currentVideo.id);
      toast.info('Video skipped. Loading another video...');
      loadRandomVideo();
    }
  }, [currentVideo, loadRandomVideo]);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true);
  }, []);

  const handleVideoRecorded = useCallback((recordedVideo: RecordedVideo) => {
    if (!currentVideo) return;
    
    // In a real app, you would upload this video to a server
    // Here we'll just store the URL locally
    videoDB.saveActingVideo(currentVideo.id, recordedVideo.url);
    
    toast.success('Your response has been saved!');
    setIsRecording(false);
    loadRandomVideo();
  }, [currentVideo, loadRandomVideo]);

  const handleCancelRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background animate-fade-in">
      <Navigation />
      
      <main className="flex-1 container max-w-5xl py-8 px-4">
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
            <Button onClick={() => navigate('/upload')} className="rounded-full px-6">
              Upload Videos
            </Button>
          </div>
        ) : isRecording && currentVideo ? (
          <div className="animate-scale-in">
            <h2 className="text-2xl font-bold mb-6">Record Your Response</h2>
            <div className="bg-card shadow-subtle rounded-xl overflow-hidden">
              <WebcamRecorder
                onVideoRecorded={handleVideoRecorded}
                onCancel={handleCancelRecording}
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
                />
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default Index;
