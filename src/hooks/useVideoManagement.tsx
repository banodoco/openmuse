import { useState, useCallback, useEffect, useRef } from 'react';
import { VideoEntry } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';

const logger = new Logger('useVideoManagement');

export const useVideoManagement = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);

  // First check if user is authenticated
  useEffect(() => {
    const checkUser = async () => {
      try {
        logger.log("useVideoManagement: Checking current user");
        const user = await getCurrentUser();
        logger.log("useVideoManagement: Current user:", user ? user.id : "not authenticated");
        if (isMounted.current) {
          setUserId(user?.id || null);
        }
      } catch (error) {
        logger.error("useVideoManagement: Error checking user:", error);
        if (isMounted.current) {
          setUserId(null);
        }
      }
    };
    
    checkUser();

    // Also set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log("useVideoManagement: Auth state changed:", event);
      if (!isMounted.current) return;
      
      if (event === 'SIGNED_IN' && session?.user) {
        logger.log("useVideoManagement: User signed in:", session.user.id);
        setUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        logger.log("useVideoManagement: User signed out");
        setUserId(null);
      }
    });

    return () => {
      logger.log("useVideoManagement: Cleaning up auth subscription");
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadAllVideos = useCallback(async () => {
    if (!isMounted.current) return;
    
    setIsLoading(true);
    fetchAttempted.current = true;
    logger.log("useVideoManagement: Loading all videos, user ID:", userId);
    
    try {
      logger.log("useVideoManagement: Getting database from switcher");
      const db = await databaseSwitcher.getDatabase();
      logger.log("useVideoManagement: Got database, fetching all entries");
      const allEntries = await db.getAllEntries();
      logger.log("useVideoManagement: Loaded entries:", allEntries.length);
      
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
      
      if (isMounted.current) {
        setVideos(transformedEntries);
        setIsLoading(false);
      }
    } catch (error) {
      logger.error("useVideoManagement: Error loading videos:", error);
      if (isMounted.current) {
        toast.error("Error loading videos. Please try again.");
        setIsLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    // Reset fetch attempt flag when userId changes
    fetchAttempted.current = false;
    
    logger.log("useVideoManagement: userId changed, reloading videos");
    if (!fetchAttempted.current) {
      loadAllVideos();
    }
  }, [loadAllVideos]);

  // Force loading state to false after a timeout to prevent infinite loading
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isLoading && isMounted.current) {
        logger.warn("useVideoManagement: Loading timeout reached, forcing completion");
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  // Cleanup effect
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      logger.log("useVideoManagement unmounting");
    };
  }, []);

  // CRUD operations for videos
  const refetchVideos = useCallback(async () => {
    if (isMounted.current) {
      await loadAllVideos();
      toast.success("Videos refreshed");
    }
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
