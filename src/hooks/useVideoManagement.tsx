import { useState, useCallback, useEffect, useRef } from 'react';
import { VideoEntry, AdminStatus } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('useVideoManagement', true, 'SessionPersist');
logger.log('useVideoManagement hook initializing');

// Define options type
interface UseVideoManagementOptions {
  approvalFilter?: 'all' | 'curated';
}

export const useVideoManagement = (options?: UseVideoManagementOptions) => {
  const { approvalFilter = 'all' } = options || {};
  logger.log(`useVideoManagement executing with options: ${JSON.stringify(options)}`);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [videoIsLoading, setVideoIsLoading] = useState(true);
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout ref
  const lastFetchErrorRef = useRef<Error | null>(null); // Ref to store last error

  const { user, isLoading: authIsLoading } = useAuth();
  const userId = user?.id || null;
  logger.log(`useVideoManagement: Auth state received - isLoading: ${authIsLoading}, userId: ${userId}`);

  const loadAllVideos = useCallback(async () => {
    if (authIsLoading) {
      logger.log('[loadAllVideos] Skipping: auth is still loading');
      return;
    }
    logger.log(`[loadAllVideos] Attempting to load videos with filter: ${approvalFilter}...`);
    if (!isMounted.current) {
      logger.log("[loadAllVideos] Skipping: Component not mounted");
      return;
    }
    if (fetchInProgress.current) {
      logger.log("[loadAllVideos] Skipping: Fetch already in progress");
      return;
    }

    logger.log('[loadAllVideos] Setting videoIsLoading = true, fetchInProgress = true');
    fetchInProgress.current = true;
    setVideoIsLoading(true);
    lastFetchErrorRef.current = null; // Reset last error on new attempt

    // Clear previous timeout if exists
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    // Set new timeout
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMounted.current && fetchInProgress.current) { // Check fetchInProgress too
        logger.warn("[loadAllVideos] Timeout reached (10s), forcing videoIsLoading=false");
        const timeoutError = new Error("Video loading timed out.");
        lastFetchErrorRef.current = timeoutError; // Store timeout error
        setVideoIsLoading(false);
        fetchInProgress.current = false;
        toast.error(timeoutError.message); // Show toast on timeout
      }
    }, 10000); // 10 second timeout

    logger.log(`[loadAllVideos] Fetching videos (User ID: ${userId}, Filter: ${approvalFilter})`);

    try {
      logger.log("[loadAllVideos] Getting database from switcher");
      const db = await databaseSwitcher.getDatabase();
      logger.log(`[loadAllVideos] Got database, fetching entries with filter: ${approvalFilter}`);
      const fetchStart = performance.now();
      const allEntries = await db.getAllEntries(approvalFilter);
      const fetchDuration = (performance.now() - fetchStart).toFixed(2);
      logger.log(`[loadAllVideos] db.getAllEntries resolved in ${fetchDuration} ms for filter: ${approvalFilter}`);

      if (!isMounted.current) {
        logger.log("[loadAllVideos] Component unmounted during fetch, discarding results.");
        // Clear timeout if unmounted during fetch
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        fetchInProgress.current = false; // Reset flag on unmount during fetch
        return;
      }

      logger.log(`[loadAllVideos] Loaded entries count: ${allEntries.length} for filter: ${approvalFilter}`);

      // Transformation logic (can remain the same)
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
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); // Clear timeout on success

    } catch (error) {
      logger.error(`[loadAllVideos] Error loading videos (filter: ${approvalFilter}):`, error);
      lastFetchErrorRef.current = error as Error; // Store actual error
      if (isMounted.current) {
        // Use specific error message if available, otherwise generic
        toast.error((error as Error).message || "Error loading videos. Please try again.");
        logger.log("[loadAllVideos] Setting videoIsLoading = false after error");
        setVideoIsLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); // Clear timeout on error
      }
    } finally {
      // Ensure fetchInProgress is reset regardless of success/error/unmount
      if (isMounted.current) {
         logger.log("[loadAllVideos] FINALLY block: Setting fetchInProgress = false");
         fetchInProgress.current = false;
      } else {
         logger.log("[loadAllVideos] FINALLY block: Component unmounted, resetting fetchInProgress=false");
         fetchInProgress.current = false; 
      }
      // Clear timeout in finally just in case (should already be cleared on success/error/timeout)
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    }
  }, [userId, approvalFilter, authIsLoading]);

  useEffect(() => {
    logger.log(`[Effect Mount/Filter Change] Running effect. Filter: ${approvalFilter}`);
    isMounted.current = true;
    lastFetchErrorRef.current = null; // Clear error on mount/filter change

    logger.log(`[Effect Mount/Filter Change] Current state: fetchInProgress=${fetchInProgress.current}`);
    
    if (!authIsLoading) {
      // Prevent duplicate fetch if one is already running from a previous render/effect cycle
      if (!fetchInProgress.current) {
        loadAllVideos();
      } else {
        logger.log('[Effect Mount/Filter Change] Fetch already in progress, skipping immediate loadAllVideos call');
      }
    } else {
      logger.log('[Effect Mount/Filter Change] Auth still loading, deferring initial video fetch');
    }

    return () => {
      logger.log('[Effect Cleanup] Setting isMounted = false');
      isMounted.current = false;
      // Clear timeout on unmount
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      logger.log("useVideoManagement cleanup complete");
    };
  }, [loadAllVideos, approvalFilter, authIsLoading]);

  const refetchVideos = useCallback(async () => {
    logger.log(`[refetchVideos] Attempting refetch with filter: ${approvalFilter}...`);
    // Check fetchInProgress flag before refetching
    if (isMounted.current && !authIsLoading && !fetchInProgress.current) {
      logger.log(`[refetchVideos] Conditions met (mounted, auth not loading, not in progress), calling loadAllVideos with filter: ${approvalFilter}`);
      await loadAllVideos();
      if (!lastFetchErrorRef.current) { // Only toast success if no error occurred
        toast.success("Videos refreshed");
      }
    } else {
      logger.log(`[refetchVideos] Skipping refetch: isMounted=${isMounted.current}, authIsLoading=${authIsLoading}, fetchInProgress=${fetchInProgress.current}`);
      if (fetchInProgress.current) {
        toast.info('Video fetch already in progress.', { duration: 2000 });
      }
      if (lastFetchErrorRef.current) {
        toast.error(`Cannot refresh: ${lastFetchErrorRef.current.message}`, { duration: 3000 });
      }
    }
  }, [loadAllVideos, authIsLoading, approvalFilter]);

  // --- CRUD operations (remain largely the same) ---
  const deleteVideo = useCallback(async (id: string) => {
    logger.log(`[deleteVideo] Attempting to delete video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      await db.deleteEntry(id);
      logger.log(`[deleteVideo] Successfully deleted ID: ${id}. Refetching videos.`);
      await refetchVideos(); // Refetch will handle its own success/error toast
      // toast.success("Video deleted successfully."); // Remove redundant toast
      return true;
    } catch (error) {
      logger.error(`[deleteVideo] Error deleting video ID ${id}:`, error);
      toast.error("Failed to delete video.");
      throw error;
    }
  }, [refetchVideos]);

  const approveVideo = useCallback(async (id: string) => {
    logger.log(`[approveVideo] Attempting to approve video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedVideo = await db.setApprovalStatus(id, "Curated");
      logger.log(`[approveVideo] Successfully approved ID: ${id}. Refetching videos.`);
      await refetchVideos();
      // toast.success("Video approved successfully."); // Remove redundant toast
      return updatedVideo;
    } catch (error) {
      logger.error(`[approveVideo] Error approving video ID ${id}:`, error);
      toast.error("Failed to approve video.");
      throw error;
    }
  }, [refetchVideos]);

  const rejectVideo = useCallback(async (id: string) => {
    logger.log(`[rejectVideo] Attempting to reject video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedVideo = await db.setApprovalStatus(id, "Rejected");
      logger.log(`[rejectVideo] Successfully rejected ID: ${id}. Refetching videos.`);
      await refetchVideos();
      // toast.success("Video rejected successfully."); // Remove redundant toast
      return updatedVideo;
    } catch (error) {
      logger.error(`[rejectVideo] Error rejecting video ID ${id}:`, error);
      toast.error("Failed to reject video.");
      throw error;
    }
  }, [refetchVideos]);

  // --- Add the new function here ---
  const setVideoAdminStatus = useCallback(async (id: string, newStatus: AdminStatus) => {
    logger.log(`[setVideoAdminStatus] Attempting to set status to ${newStatus} for video ID: ${id}`);
    try {
      const db = await databaseSwitcher.getDatabase();
      // Assuming db.setApprovalStatus can handle any AdminStatus
      // If not, we might need a more generic update method in the database layer
      const updatedVideo = await db.setApprovalStatus(id, newStatus);
      logger.log(`[setVideoAdminStatus] Successfully set status to ${newStatus} for ID: ${id}. Refetching videos.`);
      // Refetch videos to update the list. The refetch function handles its own toasts.
      await refetchVideos(); 
      return updatedVideo;
    } catch (error) {
      logger.error(`[setVideoAdminStatus] Error setting status ${newStatus} for video ID ${id}:`, error);
      toast.error(`Failed to set video status to ${newStatus}.`);
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
    rejectVideo,
    setVideoAdminStatus // Return the new function
  };
};
