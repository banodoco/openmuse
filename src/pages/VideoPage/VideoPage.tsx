
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { isValidVideoUrl } from '@/lib/utils/videoUtils';
import VideoDetails from './components/VideoDetails';
import VideoPlayerCard from './components/VideoPlayerCard';
import RelatedVideos from './components/RelatedVideos';

const VideoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<VideoEntry[]>([]);
  const [validRelatedVideos, setValidRelatedVideos] = useState<VideoEntry[]>([]);

  useEffect(() => {
    const loadVideo = async () => {
      if (!id) {
        setError("No video ID provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const db = await databaseSwitcher.getDatabase();
        const entries = await db.getAllEntries();
        const foundVideo = entries.find(entry => entry.id === id);
        
        if (foundVideo) {
          console.log('Found video:', foundVideo);
          setVideo(foundVideo);
          
          if (!foundVideo.video_location || !isValidVideoUrl(foundVideo.video_location)) {
            setVideoError("This video has an invalid or expired URL");
          }
          
          if (foundVideo.metadata?.assetId) {
            const assetId = foundVideo.metadata.assetId;
            const related = entries.filter(entry => 
              entry.id !== id && 
              entry.metadata?.assetId === assetId
            );
            
            const validVideos = related.filter(
              video => video.video_location && isValidVideoUrl(video.video_location)
            );
            
            setRelatedVideos(related);
            setValidRelatedVideos(validVideos);
          }
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

  const handleVideoLoaded = () => {
    console.log("Video loaded successfully");
    setVideoError(null);
  };
  
  const handleVideoError = () => {
    setVideoError("Could not load video. The source may be invalid or expired.");
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
        <div className="mb-4 flex items-center">
          <Button 
            variant="outline" 
            onClick={handleGoBack}
            className="mr-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Video Details</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VideoPlayerCard 
              video={video} 
              videoError={videoError}
              onVideoLoaded={handleVideoLoaded}
              onVideoError={handleVideoError}
            />
          </div>
          
          <div className="lg:col-span-1">
            <VideoDetails video={video} />
          </div>
        </div>
        
        {video.metadata?.assetId && validRelatedVideos.length > 0 && (
          <RelatedVideos 
            assetId={video.metadata.assetId} 
            videos={validRelatedVideos} 
            navigate={navigate}
          />
        )}
      </main>
    </div>
  );
};

export default VideoPage;
