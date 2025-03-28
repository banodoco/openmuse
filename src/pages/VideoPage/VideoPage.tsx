import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileVideo } from 'lucide-react';
import { toast } from 'sonner';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { VideoEntry } from '@/lib/types';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import Navigation from '@/components/Navigation';
import VideoPlayerCard from './components/VideoPlayerCard';
import VideoDetails from './components/VideoDetails';
import RelatedVideos from './components/RelatedVideos';
import { videoUrlService } from '@/lib/services/videoUrlService';

const VideoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoEntry | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isRefreshingUrl, setIsRefreshingUrl] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!id) {
        toast.error("No video ID provided");
        navigate('/');
        return;
      }

      setIsLoading(true);
      try {
        // Fetch the video from the database
        const db = await databaseSwitcher.getDatabase();
        
        // Use getAllEntries and find the one we want to ensure VideoEntry type consistency
        const allEntries = await db.getAllEntries();
        const videoData = allEntries.find(entry => entry.id === id);
        
        if (!videoData) {
          throw new Error("Video not found");
        }
        
        setVideo(videoData);
        
        // Check if this is a blob URL that needs to be replaced with a permanent URL
        if (videoData.video_location) {
          // Always attempt to get a fresh URL from the database first instead of using blob URLs
          try {
            console.log('Attempting to get permanent URL from database first');
            let permanentUrl = null;
            
            // If this appears to be a blob URL, always try to resolve it to a permanent URL
            if (videoData.video_location.startsWith('blob:')) {
              console.log('Detected blob URL, attempting to get permanent URL from database');
              permanentUrl = await videoUrlService.lookupUrlFromDatabase(videoData.id);
            }
            
            // If we found a permanent URL, use it
            if (permanentUrl) {
              console.log('Found permanent URL:', permanentUrl.substring(0, 30) + '...');
              setVideoUrl(permanentUrl);
            } else {
              // If no permanent URL is found, try forceRefreshUrl as a fallback
              const freshUrl = await videoUrlService.forceRefreshUrl(videoData.video_location);
              setVideoUrl(freshUrl);
            }
          } catch (urlError) {
            console.error('Failed to refresh video URL:', urlError);
            
            // Fallback to regular URL resolution
            const standardUrl = await videoUrlService.getVideoUrl(videoData.video_location);
            setVideoUrl(standardUrl);
          }
        }
        
        // Fetch related videos
        let relatedData: VideoEntry[] = [];
        
        // First check if this video is associated with a LoRA
        if (videoData.metadata?.assetId) {
          // Get other videos with the same asset ID that are also VideoEntry type
          const otherRelatedVideos = allEntries.filter(entry => 
            entry.id !== id && 
            entry.metadata?.assetId === videoData.metadata?.assetId
          );
          
          if (otherRelatedVideos.length > 0) {
            relatedData = otherRelatedVideos;
          }
        }
        
        // If no asset-related videos found, fall back to recent videos
        if (relatedData.length === 0) {
          // Just get a few recent videos (excluding current one)
          relatedData = allEntries
            .filter(v => v.id !== id)
            .slice(0, 5); // Limit to 5 recent videos
        }
        
        setRelatedVideos(relatedData);
        
      } catch (error) {
        console.error('Error fetching video:', error);
        toast.error("Failed to load video");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVideo();
  }, [id, navigate]);
  
  const handleRefreshUrl = async () => {
    if (!video?.video_location) return;
    
    setIsRefreshingUrl(true);
    try {
      // Try to get a permanent URL directly from the database first
      console.log('Refreshing URL: Attempting to get permanent URL from database first');
      let permanentUrl = null;
      
      // First check if we can get a permanent URL directly from the database
      try {
        permanentUrl = await videoUrlService.lookupUrlFromDatabase(video.id);
      } catch (err) {
        console.log('Could not get permanent URL directly:', err);
      }
      
      // If we got a permanent URL, use it
      if (permanentUrl) {
        console.log('Found permanent URL during refresh:', permanentUrl.substring(0, 30) + '...');
        setVideoUrl(permanentUrl);
        toast.success("Retrieved permanent video URL");
      } else {
        // Otherwise fall back to forceRefreshUrl
        const freshUrl = await videoUrlService.forceRefreshUrl(video.video_location);
        setVideoUrl(freshUrl);
        toast.success("Video URL refreshed");
      }
    } catch (error) {
      console.error('Error refreshing URL:', error);
      toast.error("Could not refresh video URL");
    } finally {
      setIsRefreshingUrl(false);
    }
  };
  
  const handleGoBack = () => {
    navigate(-1);
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

  if (!video) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <EmptyState 
            title="Video not found"
            description="The requested video could not be found."
          />
          <div className="flex justify-center mt-6">
            <Button onClick={handleGoBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
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
          <h1 className="text-2xl font-bold">{video.metadata?.title || 'Video Details'}</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VideoPlayerCard 
              video={video} 
              videoUrl={videoUrl} 
              onRefresh={handleRefreshUrl}
              isRefreshing={isRefreshingUrl}
            />
          </div>
          
          <div className="lg:col-span-1">
            <VideoDetails video={video} />
          </div>
        </div>
        
        <RelatedVideos 
          videos={relatedVideos} 
          assetId={video.metadata?.assetId} 
          navigate={navigate}
        />
      </main>
    </div>
  );
};

export default VideoPage;
