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
  const [displayVideoUrl, setDisplayVideoUrl] = useState<string | null>(null);
  const [displayPosterUrl, setDisplayPosterUrl] = useState<string | null>(null);
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
        const db = await databaseSwitcher.getDatabase();
        const allEntries = await db.getAllEntries();
        const videoData = allEntries.find(entry => entry.id === id);
        
        if (!videoData) {
          throw new Error("Video not found");
        }
        
        setVideo(videoData);
        
        if (videoData.storage_provider === 'cloudflare-stream') {
          setDisplayVideoUrl(videoData.cloudflare_playback_hls_url || null);
          setDisplayPosterUrl(videoData.cloudflare_thumbnail_url || null);
        } else if (videoData.url) {
          setDisplayPosterUrl(videoData.placeholder_image || videoData.metadata?.placeholder_image || null);
          try {
            console.log('Attempting to get permanent URL from database first for Supabase video');
            let permanentUrl = null;
            if (videoData.url.startsWith('blob:')) {
              permanentUrl = await videoUrlService.lookupUrlFromDatabase(videoData.id);
            }
            
            if (permanentUrl) {
              setDisplayVideoUrl(permanentUrl);
            } else {
              const freshUrl = await videoUrlService.forceRefreshUrl(videoData.url);
              setDisplayVideoUrl(freshUrl);
            }
          } catch (urlError) {
            console.error('Failed to refresh Supabase video URL:', urlError);
            const standardUrl = await videoUrlService.getVideoUrl(videoData.url);
            setDisplayVideoUrl(standardUrl);
          }
        } else {
          setDisplayVideoUrl(null);
          setDisplayPosterUrl(null);
        }
        
        let relatedData: VideoEntry[] = [];
        
        if (videoData.metadata?.assetId) {
          const otherRelatedVideos = allEntries.filter(entry => 
            entry.id !== id && 
            entry.metadata?.assetId === videoData.metadata?.assetId
          );
          
          if (otherRelatedVideos.length > 0) {
            relatedData = otherRelatedVideos;
          }
        }
        
        if (relatedData.length === 0) {
          relatedData = allEntries
            .filter(v => v.id !== id)
            .slice(0, 5);
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
    if (!video) return;
    
    setIsRefreshingUrl(true);
    try {
      if (video.storage_provider === 'cloudflare-stream') {
        setDisplayVideoUrl(video.cloudflare_playback_hls_url || null);
        setDisplayPosterUrl(video.cloudflare_thumbnail_url || null);
        toast.info("Cloudflare video URL re-applied.");
      } else if (video.url) {
        console.log('Refreshing Supabase URL: Attempting to get permanent URL from database first');
        let permanentUrl = null;
        try {
          permanentUrl = await videoUrlService.lookupUrlFromDatabase(video.id);
        } catch (err) {
          console.log('Could not get permanent Supabase URL directly:', err);
        }
        
        if (permanentUrl) {
          setDisplayVideoUrl(permanentUrl);
          toast.success("Retrieved permanent Supabase video URL");
        } else {
          const freshUrl = await videoUrlService.forceRefreshUrl(video.url);
          setDisplayVideoUrl(freshUrl);
          toast.success("Supabase video URL refreshed");
        }
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
              videoUrl={displayVideoUrl} 
              posterUrl={displayPosterUrl}
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
