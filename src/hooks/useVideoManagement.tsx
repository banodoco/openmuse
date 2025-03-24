
import { useState, useCallback, useEffect } from 'react';
import { VideoEntry, RecordedVideo } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const useVideoManagement = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [noVideosAvailable, setNoVideosAvailable] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // First check if user is authenticated
  useEffect(() => {
    const checkUser = async () => {
      try {
        console.log("useVideoManagement: Checking current user");
        const user = await getCurrentUser();
        console.log("useVideoManagement: Current user:", user ? user.id : "not authenticated");
        setUserId(user?.id || null);
      } catch (error) {
        console.error("useVideoManagement: Error checking user:", error);
        setUserId(null);
      }
    };
    
    checkUser();

    // Also set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("useVideoManagement: Auth state changed:", event);
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("useVideoManagement: User signed in:", session.user.id);
        setUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log("useVideoManagement: User signed out");
        setUserId(null);
      }
    });

    return () => {
      console.log("useVideoManagement: Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, []);

  const loadAllPendingVideos = useCallback(async () => {
    setIsLoading(true);
    console.log("useVideoManagement: Loading all pending videos, user ID:", userId);
    
    try {
      console.log("useVideoManagement: Getting database from switcher");
      const db = await databaseSwitcher.getDatabase();
      console.log("useVideoManagement: Got database, fetching all entries");
      const allEntries = await db.getAllEntries();
      console.log("useVideoManagement: Loaded entries:", allEntries.length);
      
      // Filter for pending entries (no acting video and not skipped)
      const pendingEntries = allEntries.filter(
        entry => !entry.acting_video_location && !entry.skipped
      );
      
      console.log("useVideoManagement: Pending entries:", pendingEntries.length);
      if (pendingEntries.length > 0) {
        console.log("useVideoManagement: First few entries:", pendingEntries.slice(0, 3));
      } else {
        console.log("useVideoManagement: No pending entries available");
      }
      
      setVideos(pendingEntries);
      
      if (pendingEntries.length === 0) {
        console.log("useVideoManagement: No pending entries available");
        setNoVideosAvailable(true);
      } else {
        setNoVideosAvailable(false);
      }
    } catch (error) {
      console.error("useVideoManagement: Error loading videos:", error);
      toast.error("Error loading videos. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    console.log("useVideoManagement: userId changed, reloading videos");
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

  // CRUD operations for videos
  const refetchVideos = useCallback(async () => {
    await loadAllPendingVideos();
    toast.success("Videos refreshed");
  }, [loadAllPendingVideos]);

  const deleteVideo = useCallback(async (id: string) => {
    try {
      const db = await databaseSwitcher.getDatabase();
      await db.deleteEntry(id);
      setVideos(prev => prev.filter(video => video.id !== id));
      return true;
    } catch (error) {
      console.error("Error deleting video:", error);
      throw error;
    }
  }, []);

  const approveVideo = useCallback(async (id: string) => {
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedVideo = await db.setApprovalStatus(id, true);
      if (updatedVideo) {
        setVideos(prev => prev.map(video => video.id === id ? { ...video, admin_approved: true } : video));
      }
      return updatedVideo;
    } catch (error) {
      console.error("Error approving video:", error);
      throw error;
    }
  }, []);

  const rejectVideo = useCallback(async (id: string) => {
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedVideo = await db.setApprovalStatus(id, false);
      if (updatedVideo) {
        setVideos(prev => prev.map(video => video.id === id ? { ...video, admin_approved: false } : video));
      }
      return updatedVideo;
    } catch (error) {
      console.error("Error rejecting video:", error);
      throw error;
    }
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
    handleVideoLoaded,
    refetchVideos,
    deleteVideo,
    approveVideo,
    rejectVideo
  };
};
