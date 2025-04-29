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
  const { approvalFilter = 'all' } = options || {}; // Default to 'all' if no options or filter provided
  logger.log(`useVideoManagement executing with options: ${JSON.stringify(options)}`);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [videoIsLoading, setVideoIsLoading] = useState(true);
  const isMounted = useRef(true);
  const fetchAttempted = useRef(false);
  const fetchInProgress = useRef(false); // Add fetch in progress flag
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Add timeout ref

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
    // fetchAttempted.current = true; // Consider if this is still needed

    // Clear previous timeout if exists
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    // Set new timeout
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMounted.current && videoIsLoading) {
        logger.warn("[loadAllVideos] Timeout reached (10s), forcing videoIsLoading=false");
        setVideoIsLoading(false);
        fetchInProgress.current = false; // Also reset progress flag on timeout
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
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); // Clear timeout on success

    } catch (error) {
      logger.error(`[loadAllVideos] Error loading videos (filter: ${approvalFilter}):`, error);
      if (isMounted.current) {
        toast.error("Error loading videos. Please try again.");
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
         logger.log("[loadAllVideos] FINALLY block: Component unmounted, fetchInProgress remains", fetchInProgress.current);
         // Reset flag even if unmounted to prevent potential issues on remount
         fetchInProgress.current = false; 
      }
    }
  }, [userId, approvalFilter, authIsLoading]); // Include authIsLoading

  useEffect(() => {
    logger.log(`[Effect Mount/Filter Change] Running effect. Filter: ${approvalFilter}`);
    isMounted.current = true;
    fetchAttempted.current = false; // Reset fetch attempt flag on mount or filter change

    logger.log(`[Effect Mount/Filter Change] Current state: fetchAttempted=${fetchAttempted.current}`);
    
    if (!authIsLoading) {
      loadAllVideos(); // Only load if auth finished
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
      // fetchAttempted.current = false; // Consider removing if fetchAttempted isn't used elsewhere
      await loadAllVideos();
      toast.success("Videos refreshed");
    } else {
      logger.log(`[refetchVideos] Skipping refetch: isMounted=${isMounted.current}, authIsLoading=${authIsLoading}, fetchInProgress=${fetchInProgress.current}`);
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
