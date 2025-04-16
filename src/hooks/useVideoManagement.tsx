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

    logger.log('[loadAllVideos] Setting videoIsLoading = true');
    setVideoIsLoading(true);
    fetchAttempted.current = true;
    logger.log("[loadAllVideos] Fetching videos (User ID for potential RLS: ", userId, ")");

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

      // Original transformation logic
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
  }, [userId]);

  useEffect(() => {
    logger.log('[Effect Mount] Running effect to trigger initial load');
    isMounted.current = true;
    fetchAttempted.current = false; // Reset fetch attempt flag on mount/effect run

    logger.log(`[Effect Mount] Current state: fetchAttempted=${fetchAttempted.current}`);
    // Trigger load immediately if not already attempted
    if (!fetchAttempted.current) {
      logger.log("[Effect Mount] Fetch not attempted, triggering video load");
      loadAllVideos();
    } else {
       logger.log("[Effect Mount] Fetch already attempted, not triggering video load");
    }

    return () => {
      logger.log('[Effect Cleanup] Setting isMounted = false');
      isMounted.current = false;
      logger.log("useVideoManagement cleanup complete");
    };
  }, [loadAllVideos]);

  const refetchVideos = useCallback(async () => {
    logger.log('[refetchVideos] Attempting refetch...');
    if (isMounted.current && !authIsLoading) {
      logger.log("[refetchVideos] Conditions met (mounted, auth not loading), calling loadAllVideos");
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

  logger.log(`useVideoManagement: Returning state - isLoading: ${videoIsLoading}, videos count: ${videos.length}`);

  return {
    videos,
    isLoading: videoIsLoading,
    userId,
    refetchVideos,
    deleteVideo,
    approveVideo,
    rejectVideo
  };
};
