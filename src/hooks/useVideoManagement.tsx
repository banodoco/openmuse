
import { useState, useCallback, useEffect } from 'react';
import { VideoEntry, RecordedVideo } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { toast } from 'sonner';

export const useVideoManagement = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [noVideosAvailable, setNoVideosAvailable] = useState(false);

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

  const handleSelectVideo = useCallback((video: VideoEntry) => {
    setCurrentVideo(video);
    setIsRecording(false);
  }, []);

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

  return {
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
  };
};
