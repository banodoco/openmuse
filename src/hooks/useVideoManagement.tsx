import { useState, useCallback, useEffect, useRef, useContext } from 'react';
import { VideoEntry } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('useVideoManagement');

export const useVideoManagement = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [videoIsLoading, setVideoIsLoading] = useState(true);
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);

  const { user, isLoading: authIsLoading } = useAuth();
  const userId = user?.id || null;

  const loadAllVideos = useCallback(async () => {
    if (!isMounted.current || authIsLoading) {
      logger.log("useVideoManagement: Skipping loadAllVideos - component not mounted or auth loading");
      return;
    }

    setVideoIsLoading(true);
    fetchAttempted.current = true;
    logger.log("useVideoManagement: Loading all videos, user ID:", userId);
    
    try {
      logger.log("useVideoManagement: Getting database from switcher");
      const db = await databaseSwitcher.getDatabase();
      logger.log("useVideoManagement: Got database, fetching all entries");
      const allEntries = await db.getAllEntries();
      
      logger.log("useVideoManagement: Loaded entries:", allEntries.length);
      
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
      
      if (isMounted.current) {
        setVideos(transformedEntries);
        setVideoIsLoading(false);
      }
    } catch (error) {
      logger.error("useVideoManagement: Error loading videos:", error);
      if (isMounted.current) {
        toast.error("Error loading videos. Please try again.");
        setVideoIsLoading(false);
      }
    }
  }, [userId, authIsLoading]);

  useEffect(() => {
    isMounted.current = true;
    fetchAttempted.current = false;

    if (!authIsLoading && !fetchAttempted.current) {
      logger.log("useVideoManagement: Auth loaded, triggering video load");
      loadAllVideos();
    }

    return () => {
      isMounted.current = false;
      logger.log("useVideoManagement unmounting");
    };
  }, [authIsLoading, userId]);

  const refetchVideos = useCallback(async () => {
    if (isMounted.current && !authIsLoading) {
      logger.log("useVideoManagement: Refetching videos");
      await loadAllVideos();
      toast.success("Videos refreshed");
    } else {
      logger.log("useVideoManagement: Skipping refetch - component not mounted or auth loading");
    }
  }, [loadAllVideos, authIsLoading]);

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

  const combinedIsLoading = authIsLoading || videoIsLoading;

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
