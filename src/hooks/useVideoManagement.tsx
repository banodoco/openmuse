import { useState, useCallback, useEffect, useRef } from 'react';
import { VideoEntry, AdminStatus } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('useVideoManagement');
logger.log('useVideoManagement hook initializing');

// Define options type
interface UseVideoManagementOptions {
  approvalFilter?: 'all' | 'curated';
}

export const useVideoManagement = (options?: UseVideoManagementOptions) => {
  const { approvalFilter = 'all' } = options || {}; // Default to 'all' if no options or filter provided
  logger.log(`useVideoManagement executing with options: ${JSON.stringify(options)}`);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [videoIsLoading, setVideoIsLoading] = useState(true);
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);

  const { user, isLoading: authIsLoading } = useAuth();
  const userId = user?.id || null;
  logger.log(`useVideoManagement: Auth state received - isLoading: ${authIsLoading}, userId: ${userId}`);

  const loadAllVideos = useCallback(async () => {
    logger.log(`[loadAllVideos] Attempting to load videos with filter: ${approvalFilter}...`);
    if (!isMounted.current) {
      logger.log("[loadAllVideos] Skipping: Component not mounted");
      return;
    }

    logger.log('[loadAllVideos] Setting videoIsLoading = true');
    setVideoIsLoading(true);
    fetchAttempted.current = true;
    logger.log(`[loadAllVideos] Fetching videos (User ID: ${userId}, Filter: ${approvalFilter})`);

    try {
      logger.log("[loadAllVideos] Getting database from switcher");
      const db = await databaseSwitcher.getDatabase();
      logger.log(`[loadAllVideos] Got database, fetching entries with filter: ${approvalFilter}`);
      // Pass the approvalFilter to the database method
      const allEntries = await db.getAllEntries(approvalFilter);

      if (!isMounted.current) {
        logger.log("[loadAllVideos] Component unmounted during fetch, discarding results.");
        return;
      }

      logger.log(`[loadAllVideos] Loaded entries count: ${allEntries.length} for filter: ${approvalFilter}`);

      // Original transformation logic (can remain the same)
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
      logger.error(`[loadAllVideos] Error loading videos (filter: ${approvalFilter}):`, error);
      if (isMounted.current) {
        toast.error("Error loading videos. Please try again.");
        logger.log("[loadAllVideos] Setting videoIsLoading = false after error");
        setVideoIsLoading(false);
      }
    }
  }, [userId, approvalFilter]); // Add approvalFilter as a dependency

  useEffect(() => {
    logger.log(`[Effect Mount/Filter Change] Running effect. Filter: ${approvalFilter}`);
    isMounted.current = true;
    fetchAttempted.current = false; // Reset fetch attempt flag on mount or filter change

    logger.log(`[Effect Mount/Filter Change] Current state: fetchAttempted=${fetchAttempted.current}`);
    
    loadAllVideos(); // Load videos whenever the hook mounts or the filter changes

    return () => {
      logger.log('[Effect Cleanup] Setting isMounted = false');
      isMounted.current = false;
      logger.log("useVideoManagement cleanup complete");
    };
  }, [loadAllVideos, approvalFilter]); // Add approvalFilter to dependency array

  const refetchVideos = useCallback(async () => {
    logger.log(`[refetchVideos] Attempting refetch with filter: ${approvalFilter}...`);
    if (isMounted.current && !authIsLoading) {
      logger.log(`[refetchVideos] Conditions met (mounted, auth not loading), calling loadAllVideos with filter: ${approvalFilter}`);
      fetchAttempted.current = false; // Reset flag
      await loadAllVideos();
      toast.success("Videos refreshed");
    } else {
      logger.log(`[refetchVideos] Skipping refetch: isMounted=${isMounted.current}, authIsLoading=${authIsLoading}`);
    }
  }, [loadAllVideos, authIsLoading, approvalFilter]); // Add approvalFilter dependency

  // --- CRUD operations (remain largely the same, but state updates trigger re-renders with potentially filtered data) ---
  const deleteVideo = useCallback(async (id: string) => {
    // ... (implementation is the same, but relies on loadAllVideos/refetch potentially filtering)
    logger.log(`[deleteVideo] Attempting to delete video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      await db.deleteEntry(id);
      logger.log(`[deleteVideo] Successfully deleted ID: ${id}. Refetching videos.`);
      await refetchVideos(); // Refetch to update the list based on the current filter
      toast.success("Video deleted successfully.");
      return true;
    } catch (error) {
      logger.error(`[deleteVideo] Error deleting video ID ${id}:`, error);
      toast.error("Failed to delete video.");
      throw error;
    }
  }, [refetchVideos]);

  const approveVideo = useCallback(async (id: string) => {
    // ... (implementation is the same, but relies on loadAllVideos/refetch potentially filtering)
    logger.log(`[approveVideo] Attempting to approve video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedVideo = await db.setApprovalStatus(id, "Curated");
      logger.log(`[approveVideo] Successfully approved ID: ${id}. Refetching videos.`);
      await refetchVideos(); // Refetch to update the list based on the current filter
      toast.success("Video approved successfully.");
      return updatedVideo; // Return the single updated video from DB if needed
    } catch (error) {
      logger.error(`[approveVideo] Error approving video ID ${id}:`, error);
      toast.error("Failed to approve video.");
      throw error;
    }
  }, [refetchVideos]);

  const rejectVideo = useCallback(async (id: string) => {
    // ... (implementation is the same, but relies on loadAllVideos/refetch potentially filtering)
    logger.log(`[rejectVideo] Attempting to reject video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedVideo = await db.setApprovalStatus(id, "Rejected");
      logger.log(`[rejectVideo] Successfully rejected ID: ${id}. Refetching videos.`);
      await refetchVideos(); // Refetch to update the list based on the current filter
      toast.success("Video rejected successfully.");
      return updatedVideo; // Return the single updated video from DB if needed
    } catch (error) {
      logger.error(`[rejectVideo] Error rejecting video ID ${id}:`, error);
      toast.error("Failed to reject video.");
      throw error;
    }
  }, [refetchVideos]);

  logger.log(`useVideoManagement: Returning state - isLoading: ${videoIsLoading}, videos count: ${videos.length}, filter: ${approvalFilter}`);

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
