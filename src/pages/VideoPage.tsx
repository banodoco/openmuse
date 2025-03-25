
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import VideoPlayer from '@/components/video/VideoPlayer';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { AspectRatio } from '@/components/ui/aspect-ratio';

const VideoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(16/9);

  useEffect(() => {
    const loadVideo = async () => {
      if (!id) {
        setError("No video ID provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Use databaseSwitcher to get the correct database instance
        const db = await databaseSwitcher.getDatabase();
        const entries = await db.getAllEntries();
        const foundVideo = entries.find(entry => entry.id === id);
        
        if (foundVideo) {
          console.log('Found video:', foundVideo);
          setVideo(foundVideo);
        } else {
          console.error('Video not found with ID:', id);
          setError("Video not found");
        }
      } catch (err) {
        console.error("Error loading video:", err);
        setError("Failed to load video");
        toast.error("Could not load the requested video");
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [id]);

  const handleVideoLoaded = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    console.log("Video loaded successfully");
    const video = event.currentTarget;
    if (video.videoWidth && video.videoHeight) {
      setAspectRatio(video.videoWidth / video.videoHeight);
    }
  };

  const handleGoBack = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <LoadingState />
        </main>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <EmptyState 
            title="Video not found"
            description={error || "The requested video could not be found."}
          />
          <div className="flex justify-center mt-6">
            <Button onClick={handleGoBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container max-w-6xl py-8 px-4">
        <div className="mb-6 flex items-center">
          <Button 
            variant="outline" 
            onClick={handleGoBack}
            className="mr-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Video from {video.reviewer_name}</h1>
        </div>
        
        <div className="bg-card shadow-md rounded-lg overflow-hidden">
          <AspectRatio ratio={aspectRatio} className="w-full">
            <VideoPlayer 
              src={video.video_location} 
              controls
              onLoadedData={handleVideoLoaded}
              muted={false}
              className="w-full h-full object-cover"
            />
          </AspectRatio>
        </div>
      </main>
    </div>
  );
};

export default VideoPage;
