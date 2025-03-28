
import { useState, useCallback, useEffect } from 'react';
import { VideoEntry } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

export const useVideoManagement = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const loadAllVideos = useCallback(async () => {
    setIsLoading(true);
    console.log("useVideoManagement: Loading all videos, user ID:", userId);
    
    try {
      console.log("useVideoManagement: Getting database from switcher");
      const db = await databaseSwitcher.getDatabase();
      console.log("useVideoManagement: Got database, fetching all entries");
      const allEntries = await db.getAllEntries();
      console.log("useVideoManagement: Loaded entries:", allEntries.length);
      
      // Transform entries to add isPrimary flag if needed
      const transformedEntries = allEntries.map(entry => {
        if (entry.metadata && entry.metadata.assetId) {
          // Check if this is the primary media for its asset
          const isPrimary = entry.metadata.isPrimary === true;
          return {
            ...entry,
            metadata: {
              ...entry.metadata,
              isPrimary
            }
          };
        }
        return entry;
      });
      
      setVideos(transformedEntries);
    } catch (error) {
      console.error("useVideoManagement: Error loading videos:", error);
      toast.error("Error loading videos. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    console.log("useVideoManagement: userId changed, reloading videos");
    loadAllVideos();
  }, [loadAllVideos]);

  // CRUD operations for videos
  const refetchVideos = useCallback(async () => {
    await loadAllVideos();
    toast.success("Videos refreshed");
  }, [loadAllVideos]);

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
      const updatedVideo = await db.setApprovalStatus(id, "Curated");
      if (updatedVideo) {
        setVideos(prev => prev.map(video => 
          video.id === id ? { ...video, admin_approved: "Curated" } : video
        ));
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
      const updatedVideo = await db.setApprovalStatus(id, "Rejected");
      if (updatedVideo) {
        setVideos(prev => prev.map(video => 
          video.id === id ? { ...video, admin_approved: "Rejected" } : video
        ));
      }
      return updatedVideo;
    } catch (error) {
      console.error("Error rejecting video:", error);
      throw error;
    }
  }, []);

  return {
    videos,
    isLoading,
    refetchVideos,
    deleteVideo,
    approveVideo,
    rejectVideo
  };
};
