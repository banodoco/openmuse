import { useState, useCallback, useEffect, useRef, useContext } from 'react';
import { VideoEntry } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('useVideoManagement');
logger.log('useVideoManagement hook initializing');

export const useVideoManagement = () => {
  logger.log('useVideoManagement executing');
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [videoIsLoading, setVideoIsLoading] = useState(true);
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);

  const { user, isLoading: authIsLoading } = useAuth();
  const userId = user?.id || null;
  logger.log(`useVideoManagement: Auth state received - isLoading: ${authIsLoading}, userId: ${userId}`);

  const loadAllVideos = useCallback(async () => {
    logger.log('[loadAllVideos] Attempting to load videos...');
    if (!isMounted.current) {
      logger.log("[loadAllVideos] Skipping: Component not mounted");
      return;
    }
    // Keep the authIsLoading check for now as per original logic, but log its effect
    if (authIsLoading) {
       logger.log("[loadAllVideos] Skipping: Auth is still loading");
       return;
    }

    logger.log('[loadAllVideos] Setting videoIsLoading = true');
    setVideoIsLoading(true);
    fetchAttempted.current = true;
    logger.log("[loadAllVideos] Fetching videos for user ID:", userId);

    try {
      logger.log("[loadAllVideos] Getting database from switcher");
      const db = await databaseSwitcher.getDatabase();
      logger.log("[loadAllVideos] Got database, fetching all entries");
      const allEntries = await db.getAllEntries();

      if (!isMounted.current) {
        logger.log("[loadAllVideos] Component unmounted during fetch, discarding results.");
        return;
      }

      logger.log("[loadAllVideos] Loaded entries count:", allEntries.length);

      // Original transformation logic - consider adding logs inside map if needed
      const transformedEntries = allEntries.map(entry => {
        if (entry.metadata && entry.metadata.assetId) {
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

      logger.log("[loadAllVideos] Setting videos state and videoIsLoading = false");
      setVideos(transformedEntries);
      setVideoIsLoading(false);

    } catch (error) {
      logger.error("[loadAllVideos] Error loading videos:", error);
      if (isMounted.current) {
        toast.error("Error loading videos. Please try again.");
        logger.log("[loadAllVideos] Setting videoIsLoading = false after error");
        setVideoIsLoading(false);
      }
    }
  }, [userId, authIsLoading]); // Keep authIsLoading dependency as per original logic for now

  useEffect(() => {
    logger.log('[Effect Mount/Auth Change] Running effect');
    isMounted.current = true;
    fetchAttempted.current = false; // Reset fetch attempt flag on effect run

    logger.log(`[Effect Mount/Auth Change] Current state: authIsLoading=${authIsLoading}, fetchAttempted=${fetchAttempted.current}`);
    if (!authIsLoading && !fetchAttempted.current) {
      logger.log("[Effect Mount/Auth Change] Auth loaded and fetch not attempted, triggering video load");
      loadAllVideos();
    } else if (authIsLoading) {
       logger.log("[Effect Mount/Auth Change] Waiting for auth to load before triggering video load");
    } else if (fetchAttempted.current) {
       logger.log("[Effect Mount/Auth Change] Fetch already attempted, not triggering video load");
    }

    return () => {
      logger.log('[Effect Cleanup] Setting isMounted = false');
      isMounted.current = false;
      logger.log("useVideoManagement cleanup complete");
    };
  // Dependency array includes authIsLoading and userId as per original logic
  }, [authIsLoading, userId, loadAllVideos]);

  const refetchVideos = useCallback(async () => {
    logger.log('[refetchVideos] Attempting refetch...');
    if (isMounted.current && !authIsLoading) {
      logger.log("[refetchVideos] Conditions met, calling loadAllVideos");
      fetchAttempted.current = false; // Reset fetch attempt flag before refetching
      await loadAllVideos();
      toast.success("Videos refreshed");
    } else {
      logger.log(`[refetchVideos] Skipping refetch: isMounted=${isMounted.current}, authIsLoading=${authIsLoading}`);
    }
  }, [loadAllVideos, authIsLoading]);

  // --- CRUD operations (logging added) ---
  const deleteVideo = useCallback(async (id: string) => {
    logger.log(`[deleteVideo] Attempting to delete video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      await db.deleteEntry(id);
      logger.log(`[deleteVideo] Successfully deleted, updating state for ID: ${id}`);
      setVideos(prev => prev.filter(video => video.id !== id));
      return true;
    } catch (error) {
      logger.error(`[deleteVideo] Error deleting video ID ${id}:`, error);
      throw error;
    }
  }, []);

  const approveVideo = useCallback(async (id: string) => {
     logger.log(`[approveVideo] Attempting to approve video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedVideo = await db.setApprovalStatus(id, "Curated");
      if (updatedVideo) {
        logger.log(`[approveVideo] Successfully approved, updating state for ID: ${id}`);
        setVideos(prev => prev.map(video =>
          video.id === id ? { ...video, admin_approved: "Curated" } : video
        ));
      }
      return updatedVideo;
    } catch (error) {
      logger.error(`[approveVideo] Error approving video ID ${id}:`, error);
      throw error;
    }
  }, []);

  const rejectVideo = useCallback(async (id: string) => {
    logger.log(`[rejectVideo] Attempting to reject video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedVideo = await db.setApprovalStatus(id, "Rejected");
      if (updatedVideo) {
         logger.log(`[rejectVideo] Successfully rejected, updating state for ID: ${id}`);
        setVideos(prev => prev.map(video =>
          video.id === id ? { ...video, admin_approved: "Rejected" } : video
        ));
      }
      return updatedVideo;
    } catch (error) {
      logger.error(`[rejectVideo] Error rejecting video ID ${id}:`, error);
      throw error;
    }
  }, []);

  // Keep original isLoading logic but log the result
  const combinedIsLoading = authIsLoading || videoIsLoading;
  logger.log(`useVideoManagement: Returning state - combinedIsLoading: ${combinedIsLoading} (auth: ${authIsLoading}, video: ${videoIsLoading}), videos count: ${videos.length}`);

  return {
    videos,
    isLoading: combinedIsLoading,
    userId,
    refetchVideos,
    deleteVideo,
    approveVideo,
    rejectVideo
  };
};
