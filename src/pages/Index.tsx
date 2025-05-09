import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import { useLoraManagement } from '@/hooks/useLoraManagement';
import LoraManager from '@/components/LoraManager';
import { useAuth } from '@/hooks/useAuth';
import { testRLSPermissions } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LoraAsset, VideoEntry, AdminStatus } from '@/lib/types';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import UploadPage from '@/pages/upload/UploadPage';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import VideoLightbox from '@/components/VideoLightbox';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';

const logger = new Logger('IndexPage', true, 'SessionPersist');
const LORA_INDEX_PERF_ID_PREFIX = '[LoraLoadSpeed_IndexPage]';
const INDEX_LORA_ITEMS_PER_PAGE = 6; // Number of LoRAs to display per page on Index

// === Helper Functions (Copied from UserProfilePage) ===

// Simple pagination helper
const getPaginatedItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
    if (pageSize <= 0) return items; // Return all if page size is invalid
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, Math.min(endIndex, items.length)); // Ensure endIndex doesn't exceed array bounds
};

// Calculate total pages
const getTotalPages = (totalItems: number, pageSize: number): number => {
    if (pageSize <= 0 || totalItems <= 0) return 1; // Handle edge cases
    return Math.ceil(totalItems / pageSize);
};

// Smooth scroll helper
const scrollToElementWithOffset = (element: HTMLElement | null, offset: number = -150) => {
  if (!element) return;
  const y = element.getBoundingClientRect().top + window.pageYOffset + offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
};

const Index: React.FC = () => {
  logger.log('[Index] component rendered');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  // logger.log(`Index: useAuth() state - user: ${user?.id || 'null'}, authLoading: ${authLoading}, isAdmin: ${isAdmin}`);

  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const permissionCheckInProgress = useRef(false);
  const dataRefreshInProgress = useRef(false);
  const initialRefreshDone = useRef(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  
  // Pagination State
  const [artPage, setArtPage] = useState(1);
  const [generationPage, setGenerationPage] = useState(1);
  
  // Refs for scrolling
  const artSectionRef = useRef<HTMLDivElement>(null);
  const generationsSectionRef = useRef<HTMLDivElement>(null);
  
  // Get video data & loading state
  const { 
    videos, 
    isLoading: videosLoading, 
    approveVideo, // Keep for potential other uses, but not in lightbox handler
    rejectVideo,  // Keep for potential other uses, but not in lightbox handler
    refetchVideos, 
    setVideoAdminStatus // Import the new function
  } = useVideoManagement();
  // logger.log(`Index: useVideoManagement() state - videosLoading: ${videosLoading}`);
  
  // Get model filter from URL query params
  const [searchParams, setSearchParams] = useSearchParams();
  const modelFilterFromUrl = searchParams.get('model') || 'all';
  // logger.log(`Index: Model filter from URL: ${modelFilterFromUrl}`);

  // Add state to store asset_media associations
  const [videoAssetMap, setVideoAssetMap] = useState<Record<string, string>>({});

  // Add effect to fetch asset_media associations when videos change
  useEffect(() => {
    if (!videos || videos.length === 0) return;
    
    const fetchAssetAssociations = async () => {
      const videoIds = videos.map(v => v.id);
      const { data: assetLinks, error: linksError } = await supabase
        .from('asset_media')
        .select('media_id, asset_id')
        .in('media_id', videoIds);

      if (linksError) {
        logger.error('Error fetching asset_media links:', linksError);
        return;
      }

      const newMap: Record<string, string> = {};
      assetLinks?.forEach(link => {
        if (link.media_id && link.asset_id) {
          newMap[link.media_id] = link.asset_id;
        }
      });
      setVideoAssetMap(newMap);
    };

    fetchAssetAssociations();
  }, [videos]);
  
  // LIFTED STATE:
  const [currentModelFilter, setCurrentModelFilter] = useState(modelFilterFromUrl);
  const [filterText, setFilterText] = useState('');
  const [currentApprovalFilter, setCurrentApprovalFilter] = useState<'curated' | 'all'>('curated');
  const [loraDisplayPage, setLoraDisplayPage] = useState(1); // State for LoRA pagination on Index page
  const fetchTimerStartedRef = useRef(false); // Ref to track if fetch timer has started

  // Pass filters and pagination parameters to the hook
  console.time(`${LORA_INDEX_PERF_ID_PREFIX}_useLoraManagement_HookInitialization`);
  const { 
    loras, 
    isLoading: lorasLoading, 
    totalCount: totalLorasFromHook, // Get totalCount from the hook
    refetchLoras
  } = useLoraManagement({ 
    modelFilter: currentModelFilter, 
    approvalFilter: currentApprovalFilter,
    page: loraDisplayPage,          // Pass current page
    pageSize: INDEX_LORA_ITEMS_PER_PAGE // Pass page size
  });
  console.timeEnd(`${LORA_INDEX_PERF_ID_PREFIX}_useLoraManagement_HookInitialization`);

  useEffect(() => {
    if (lorasLoading && !fetchTimerStartedRef.current) {
      console.time(`${LORA_INDEX_PERF_ID_PREFIX}_useLoraManagement_FetchDuration`);
      fetchTimerStartedRef.current = true;
    } else if (!lorasLoading && fetchTimerStartedRef.current) {
      // This condition means loading has finished *and* the timer was previously started.
      console.timeEnd(`${LORA_INDEX_PERF_ID_PREFIX}_useLoraManagement_FetchDuration`);
      fetchTimerStartedRef.current = false; // Reset for potential subsequent fetches
    }
  }, [lorasLoading]); // Depend only on lorasLoading for starting/ending the timer
  
  // logger.log(`Index: useLoraManagement() state - lorasLoading: ${lorasLoading}, loras count: ${loras?.length || 0}`);
  
  // Client-side filtering for TEXT only
  const displayLoras = React.useMemo(() => {
    console.time(`${LORA_INDEX_PERF_ID_PREFIX}_Memo_displayLoras`);
    // logger.log('[Memo displayLoras] Calculating text filter...');
    if (!loras || loras.length === 0) {
      // logger.log('[Memo displayLoras] No LoRAs available (post-backend-filter), returning empty array.');
      console.timeEnd(`${LORA_INDEX_PERF_ID_PREFIX}_Memo_displayLoras`);
      return [];
    }
    
    if (!filterText) {
      // logger.log('[Memo displayLoras] No text filter applied, returning all loras from hook.');
      console.timeEnd(`${LORA_INDEX_PERF_ID_PREFIX}_Memo_displayLoras`);
      return loras; // Return all if no text filter
    }

    const lowerCaseFilter = filterText.toLowerCase();
    const filtered = loras.filter(lora => 
      lora.name?.toLowerCase().includes(lowerCaseFilter) ||
      lora.description?.toLowerCase().includes(lowerCaseFilter) ||
      lora.creator?.toLowerCase().includes(lowerCaseFilter) ||
      lora.lora_base_model?.toLowerCase().includes(lowerCaseFilter)
    );
    // logger.log(`[Memo displayLoras] Applying text filter '${filterText}', count: ${filtered.length}`);
    console.timeEnd(`${LORA_INDEX_PERF_ID_PREFIX}_Memo_displayLoras`);
    return filtered;

  }, [loras, filterText]); // displayLoras now depends on loras (paginated from hook) and filterText

  const totalLoraDisplayPages = React.useMemo(() => {
    console.time(`${LORA_INDEX_PERF_ID_PREFIX}_Memo_totalLoraDisplayPages`);
    // Calculate based on totalLorasFromHook and items per page
    const result = getTotalPages(totalLorasFromHook, INDEX_LORA_ITEMS_PER_PAGE);
    console.timeEnd(`${LORA_INDEX_PERF_ID_PREFIX}_Memo_totalLoraDisplayPages`);
    return result;
  }, [totalLorasFromHook]); // Depends on totalCount from hook
  
  // Add lifecycle logging
  useEffect(() => {
    // logger.log('[Effect Lifecycle] Index page mounted');
    return () => {
      // logger.log('[Effect Lifecycle] Index page unmounting'); // This should fire right before unload
    };
  }, []);
  
  // Only check permissions if user is authenticated and not still loading
  useEffect(() => {
    // logger.log(`[Effect Permissions] Running. State: authLoading=${authLoading}, user=${!!user}, checked=${permissionsChecked}, inProgress=${permissionCheckInProgress.current}`);
    if (authLoading) {
      // logger.log('[Effect Permissions] Waiting for auth to load.');
      return;
    }
    if (!user) {
        // logger.log('[Effect Permissions] No user logged in, skipping permission check.');
        // Ensure checked is false if user logs out
        if (permissionsChecked) setPermissionsChecked(false);
        return;
    }
    if (permissionsChecked || permissionCheckInProgress.current) {
        // logger.log(`[Effect Permissions] Skipping check: Already checked (${permissionsChecked}) or in progress (${permissionCheckInProgress.current}).`);
        return;
    }
    
    const checkPermissions = async () => {
      // logger.log('[Effect Permissions] Starting check for user:', user.id);
      permissionCheckInProgress.current = true;
      
      try {
        // logger.log('Checking user permissions for:', user.id);
        const permissions = await testRLSPermissions();
        // logger.log('[Effect Permissions] RLS check result:', permissions);
        setPermissionsChecked(true);
        
        if (!permissions.assetsAccess || !permissions.mediaAccess) {
          // logger.warn('[Effect Permissions] Permission issues detected!');
          toast.error("Permission issues detected. Some data may not be visible.", {
            description: "Try refreshing the data or contact an administrator.",
            duration: 5000
          });
        } else {
            // logger.log('[Effect Permissions] RLS check passed.');
        }
      } catch (err) {
        // logger.error("[Effect Permissions] Error checking permissions:", err);
        // Should we mark as checked on error? Maybe not, allow retry later?
        // setPermissionsChecked(true);
      } finally {
        // logger.log('[Effect Permissions] Check finished.');
        permissionCheckInProgress.current = false;
      }
    };
    
    checkPermissions();
    
    return () => {
      // logger.log('Index page unloading');
    };
  }, [user, permissionsChecked, authLoading]);
  
  // Refresh data when user is authenticated
  useEffect(() => {
    // logger.log(`[Effect Initial Refresh] Running. State: authLoading=${authLoading}, user=${!!user}, lorasLoading=${lorasLoading}, refreshInProgress=${dataRefreshInProgress.current}, initialDone=${initialRefreshDone.current}`);
    if (authLoading) {
       // logger.log('[Effect Initial Refresh] Waiting for auth.');
       return;
    }
    if (!user) {
       // logger.log('[Effect Initial Refresh] No user, skipping initial refresh.');
       // Reset flag if user logs out?
       // initialRefreshDone.current = false; // Consider if this is needed
       // sessionStorage.removeItem('initialDataRefreshed'); // Also maybe clear session storage
       return;
    }

    const hasRefreshedSession = sessionStorage.getItem('initialDataRefreshed') === 'true';
    // logger.log(`[Effect Initial Refresh] Session storage 'initialDataRefreshed': ${hasRefreshedSession}`);

    if (!lorasLoading && !dataRefreshInProgress.current && !hasRefreshedSession && !initialRefreshDone.current) {
      // logger.log('[Effect Initial Refresh] Conditions met: User logged in, not loading, not in progress, not refreshed yet. Triggering refetchLoras with timeout.');
      dataRefreshInProgress.current = true;
      initialRefreshDone.current = true; // Mark as done for this component instance

      const timeoutId = setTimeout(() => {
        // logger.log('[Effect Initial Refresh] Timeout executed, calling refetchLoras()');
        refetchLoras().finally(() => {
          // logger.log('[Effect Initial Refresh] refetchLoras() finished. Setting refreshInProgress=false and session storage.');
          dataRefreshInProgress.current = false;
          sessionStorage.setItem('initialDataRefreshed', 'true'); // Mark as done in session storage
        });
      }, 100); // Short delay

      return () => {
          // logger.log('[Effect Initial Refresh] Cleanup: Clearing timeout.');
          clearTimeout(timeoutId);
          // Should we reset dataRefreshInProgress here? Probably not, let the finally block handle it.
      };
    } else {
        // logger.log('[Effect Initial Refresh] Conditions not met, skipping timed refresh.');
    }
  }, [user, refetchLoras, lorasLoading, authLoading]);
  
  const handleNavigateToUpload = useCallback(() => {
    // logger.log('Index: Navigating to /upload');
    navigate('/upload');
  }, [navigate]);
  
  const handleRefreshData = useCallback(async () => {
    // logger.log('[Manual Refresh] Clicked.');
    if (dataRefreshInProgress.current) {
      // logger.log('[Manual Refresh] Skipping: Refresh already in progress.');
      return;
    }
    // logger.log('[Manual Refresh] Starting refresh...');
    dataRefreshInProgress.current = true;
    
    try {
      await refetchLoras();
      // logger.log('[Manual Refresh] LoRA refresh successful.');
      
      // Re-check permissions after refresh
      if (user && !permissionCheckInProgress.current) {
        // logger.log('[Manual Refresh] Starting post-refresh permission check.');
        permissionCheckInProgress.current = true;
        const permissions = await testRLSPermissions();
        setPermissionsChecked(true);
        // logger.log('[Manual Refresh] Post-refresh RLS check result:', permissions);
        if (!permissions.assetsAccess || !permissions.mediaAccess) {
           // logger.warn('[Manual Refresh] Permission issues detected after refresh!');
          toast.error("Permission issues detected. Some data may not be visible.", {
            description: "Try refreshing the data or contact an administrator.",
            duration: 5000
          });
        }
        permissionCheckInProgress.current = false;
         // logger.log('[Manual Refresh] Post-refresh permission check finished.');
      } else {
          // logger.log('[Manual Refresh] Skipping post-refresh permission check (no user or check already in progress).');
      }
    } catch (error) {
      // logger.error('[Manual Refresh] Error during refresh:', error);
      // Assuming refetchLoras shows its own toast on error
    } finally {
      // logger.log('[Manual Refresh] Refresh finished.');
      dataRefreshInProgress.current = false;
    }
  }, [refetchLoras, user]); // Added user dependency
  
  // --- Upload Success Handlers ---
  const handleLoraUploadSuccess = useCallback(() => {
    setIsUploadModalOpen(false);
    // Refetch LoRAs to show the newly added one
    refetchLoras();
    toast.success("LoRA added successfully!");
  }, [refetchLoras]);

  const handleArtUploadSuccess = useCallback(() => {
    setIsUploadModalOpen(false); // Close the specific modal
    refetchVideos(); // Refetch videos
    toast.success("Art uploaded successfully!");
    toast.info("Video uploaded, check your profile to see it.");
  }, [refetchVideos]);

  const handleGenerationUploadSuccess = useCallback(() => {
    setIsUploadModalOpen(false); // Close the specific modal
    refetchVideos(); // Refetch videos
    toast.success("Generation uploaded successfully!");
    toast.info("Video uploaded, check your profile to see it.");
  }, [refetchVideos]);

  // logger.log(`Index rendering return. videosLoading=${videosLoading}, lorasLoading=${lorasLoading}, authLoading=${authLoading}, displayLoras count=${displayLoras.length}`);
  // Page loading state now depends on videos finishing
  const isPageLoading = videosLoading;
  // Actions might still be disabled if auth or LoRAs are loading (prevent interaction with incomplete data)
  const isActionDisabled = videosLoading || lorasLoading || authLoading;

  // Update URL when model filter changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentModelFilter === 'all') {
      params.delete('model');
    } else {
      params.set('model', currentModelFilter);
    }
    // Use replace: true to avoid adding history entries for filter changes
    setSearchParams(params, { replace: true }); 
  }, [currentModelFilter, searchParams, setSearchParams]);

  // Update local model filter state if URL changes directly
  useEffect(() => {
    setCurrentModelFilter(modelFilterFromUrl);
  }, [modelFilterFromUrl]);

  // -----------------------------
  // Video Sections Filtering (Respecting Approval Filter)
  // -----------------------------
  const displayVideos = React.useMemo(() => {
    if (currentApprovalFilter === 'all') {
      // Show Curated, Featured, AND Listed when 'All' is selected
      return videos.filter(v => ['Curated', 'Featured', 'Listed'].includes(v.admin_status));
    } else {
      // Default to showing only Curated and Featured
      return videos.filter(v => ['Curated', 'Featured'].includes(v.admin_status));
    }
  }, [videos, currentApprovalFilter]); // Depend on both videos and the filter state

  // Define page sizes for different sections
  const ART_PAGE_SIZE = 8;
  const GENERATION_PAGE_SIZE = 12; // Show fewer generations per page (two rows at 6 each)

  const displayArtVideos = React.useMemo(() => {
    const filtered = displayVideos.filter(v => v.metadata?.classification === 'art');
    const totalItems = filtered.length;
    const totalPages = getTotalPages(totalItems, ART_PAGE_SIZE);
    const paginatedItems = getPaginatedItems(filtered, artPage, ART_PAGE_SIZE);
    return { items: paginatedItems, totalPages: totalPages };
  }, [displayVideos, artPage]); // Depend on filtered list and current page

  const displayGenVideos = React.useMemo(() => {
    const filtered = displayVideos.filter(v => v.metadata?.classification !== 'art');
    const totalItems = filtered.length;
    const totalPages = getTotalPages(totalItems, GENERATION_PAGE_SIZE);
    const paginatedItems = getPaginatedItems(filtered, generationPage, GENERATION_PAGE_SIZE);
    return { items: paginatedItems, totalPages: totalPages };
  }, [displayVideos, generationPage]); // Depend on filtered list and current page

  // Pagination Handlers
  const handleArtPageChange = useCallback((newPage: number) => {
    setArtPage(newPage);
    if (isMobile) {
      scrollToElementWithOffset(artSectionRef.current);
    }
  }, [isMobile]);

  const handleGenerationPageChange = useCallback((newPage: number) => {
    setGenerationPage(newPage);
    if (isMobile) {
      scrollToElementWithOffset(generationsSectionRef.current);
    }
  }, [isMobile]);

  // Pagination UI Renderer (Copied from UserProfilePage)
  const renderPaginationControls = (
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void,
  ) => {
    if (totalPages <= 1) return null; // Don't render if only one page

    const handlePrevious = () => {
      if (currentPage > 1) onPageChange(currentPage - 1);
    };

    const handleNext = () => {
      if (currentPage < totalPages) onPageChange(currentPage + 1);
    };

    // Determine pagination items to display (simplified logic)
    const paginationItems = [];
    const maxPagesToShow = 5; // Max number of page links shown
    const ellipsis = <PaginationEllipsis key="ellipsis" />;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        paginationItems.push(
          <PaginationItem key={i}>
            <PaginationLink href="#" isActive={currentPage === i} onClick={(e) => { e.preventDefault(); onPageChange(i); }}>
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Always show first page
      paginationItems.push(
        <PaginationItem key={1}>
          <PaginationLink href="#" isActive={currentPage === 1} onClick={(e) => { e.preventDefault(); onPageChange(1); }}>
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Logic for ellipsis and middle pages
      if (currentPage > 3) {
         // Use React.cloneElement to ensure a unique key for potentially multiple ellipses
        paginationItems.push(React.cloneElement(ellipsis, { key: "start-ellipsis" }));
      }

      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);

       // Adjust range if near the beginning or end to maintain maxPagesToShow behavior
      if (currentPage <= 3) {
           // Show first page, ellipsis, and remaining pages up to maxPagesToShow - 2
          endPage = Math.min(totalPages - 1, maxPagesToShow - 2); // Account for first page and end ellipsis potentially
      }
      if (currentPage >= totalPages - 2) {
           // Show last page, ellipsis, and preceding pages
          startPage = Math.max(2, totalPages - maxPagesToShow + 2); // Account for last page and start ellipsis
      }


      for (let i = startPage; i <= endPage; i++) {
        paginationItems.push(
          // Hide intermediate links on mobile, show on medium screens and up
          // Only show the current page link within the intermediate range on mobile
          <PaginationItem key={i} className={cn(currentPage === i ? "" : "hidden md:list-item")}>
            <PaginationLink href="#" isActive={currentPage === i} onClick={(e) => { e.preventDefault(); onPageChange(i); }}>
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      if (currentPage < totalPages - 2) {
         // Use React.cloneElement here too
        paginationItems.push(React.cloneElement(ellipsis, { key: "end-ellipsis" }));
      }

      // Always show last page
      paginationItems.push(
        <PaginationItem key={totalPages}>
          <PaginationLink href="#" isActive={currentPage === totalPages} onClick={(e) => { e.preventDefault(); onPageChange(totalPages); }}>
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return (
      <Pagination className="mt-6">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePrevious(); }} aria-disabled={currentPage === 1} className={cn(currentPage === 1 && 'pointer-events-none opacity-50')} />
          </PaginationItem>
          {paginationItems}
          <PaginationItem>
            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); handleNext(); }} aria-disabled={currentPage === totalPages} className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  // Define items per row for different sections
  const GENERATION_ITEMS_PER_ROW = 6;
  const ART_ITEMS_PER_ROW = 4;

  // --- Lightbox Handlers ---
  const handleOpenLightbox = useCallback((video: VideoEntry) => {
    logger.log(`[Lightbox] Opening lightbox for video: ${video.id}`);
    setLightboxVideo(video);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    logger.log(`[Lightbox] Closing lightbox`);
    setLightboxVideo(null);
  }, []);

  // Compute a flattened list of currently displayed videos (art + generations) for navigation
  const lightboxVideoList = useMemo(() => {
    return [...displayArtVideos.items, ...displayGenVideos.items];
  }, [displayArtVideos.items, displayGenVideos.items]);

  const currentLightboxIndex = useMemo(() => {
    if (!lightboxVideo) return -1;
    return lightboxVideoList.findIndex(v => v.id === lightboxVideo.id);
  }, [lightboxVideo, lightboxVideoList]);

  const handlePrevLightboxVideo = useCallback(() => {
    if (currentLightboxIndex > 0) {
      setLightboxVideo(lightboxVideoList[currentLightboxIndex - 1]);
    }
  }, [currentLightboxIndex, lightboxVideoList]);

  const handleNextLightboxVideo = useCallback(() => {
    if (currentLightboxIndex !== -1 && currentLightboxIndex < lightboxVideoList.length - 1) {
      setLightboxVideo(lightboxVideoList[currentLightboxIndex + 1]);
    }
  }, [currentLightboxIndex, lightboxVideoList]);

  // This function now RETURNS the actual handler needed by the Lightbox
  const getLightboxAdminStatusChangeHandler = useCallback((videoId: string) => {
    return async (newStatus: AdminStatus) => {
      logger.log(`[Lightbox] Admin status change requested: ${videoId} to ${newStatus}`);
      try {
        // Directly use the new function from the hook
        await setVideoAdminStatus(videoId, newStatus);
        // The hook's refetchVideos handles success/error toasts now
        toast.success(`Video status set to ${newStatus}.`); // Optional: Add specific success toast here if desired
        handleCloseLightbox(); // Close lightbox after update
      } catch (error) {
        logger.error(`[Lightbox] Error changing admin status for ${videoId} to ${newStatus}:`, error);
        // Error toast is handled within setVideoAdminStatus or refetchVideos
        // toast.error("Failed to update video status."); // Can remove this redundant toast
      }
    };
  }, [setVideoAdminStatus, handleCloseLightbox]);

  const handleLightboxVideoUpdate = useCallback(() => {
    logger.log(`[Lightbox] Video update occurred (internally within lightbox), refetching videos.`);
    refetchVideos();
  }, [refetchVideos]);
  // --- End Lightbox Handlers ---

  // -----------------------------
  // Open lightbox automatically if ?video query param is present
  // -----------------------------
  useEffect(() => {
    const videoParam = searchParams.get('video');
    if (!videoParam) return;

    // If lightbox already open for this video, do nothing
    if (lightboxVideo && lightboxVideo.id === videoParam) return;

    // Once we have the video list, try to find the video and open it
    if (videos && videos.length > 0) {
      const found = videos.find(v => v.id === videoParam);
      if (found) {
        handleOpenLightbox(found);
      }
    }
  }, [searchParams, videos, lightboxVideo, handleOpenLightbox]);

  // Refs for fade-in sections
  const loraSectionRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Apply fade-in animation when each section scrolls into view
  console.time(`${LORA_INDEX_PERF_ID_PREFIX}_ComponentSetup`);
  useFadeInOnScroll(loraSectionRef);
  useFadeInOnScroll(artSectionRef);
  useFadeInOnScroll(generationsSectionRef);
  useFadeInOnScroll(heroRef);
  console.timeEnd(`${LORA_INDEX_PERF_ID_PREFIX}_ComponentSetup`);

  // Add a useEffect to log when loras data is received/updated from the hook
  React.useEffect(() => {
    if (loras) { // Keep this log for data arrival visibility
      console.log(`${LORA_INDEX_PERF_ID_PREFIX}_useLoraManagement_DataReceived`, { count: loras.length, isLoading: lorasLoading });
    }
  }, [loras, lorasLoading]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <div ref={heroRef} className="pt-2 pb-0 mb-4">
            <PageHeader 
              title="Curated resources & art, with a focus on LoRAs for open video models"
              description="A collection of LoRAs for open video models like Wan, LTXV and Hunyuan, alongside art created with them." 
            />
          </div>
          
          {/* Search Input - Commented out for now */}
          {/* 
          <div className="mt-6 mb-4 max-w-md mx-auto">
            <Input
              type="text"
              placeholder="Search LoRAs by name, creator, model, description..."
              value={filterText}
              onChange={(e) => {
                const newText = e.target.value;
                setFilterText(newText);
                // If user starts typing, switch approval filter to 'all'
                if (newText.length > 0 && currentApprovalFilter !== 'all') {
                  setCurrentApprovalFilter('all');
                }
              }}
              className="w-full"
            />
          </div>
          */}

          {/* Approval Filter Toggle Group - Reduced top margin */}
          <div className="flex justify-start mt-2 mb-6">
            <ToggleGroup 
              type="single" 
              value={currentApprovalFilter} 
              onValueChange={(value) => {
                // Only allow setting to 'curated' or 'all'
                if (value === 'curated' || value === 'all') {
                   setCurrentApprovalFilter(value);
                }
              }}
              className="bg-muted/50 p-1 rounded-lg"
            >
              <ToggleGroupItem value="curated" aria-label="Toggle curated" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
                Curated
              </ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="Toggle all" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
                All
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator className="mt-0 mb-4" />

          {/* LoRA Section */}
          <div ref={loraSectionRef}>
            {void console.time(`${LORA_INDEX_PERF_ID_PREFIX}_Render_LoraManagerSection`)}
            <LoraManager
              loras={displayLoras}
              isLoading={lorasLoading}
              lorasAreLoading={lorasLoading}
              filterText={filterText}
              onFilterTextChange={setFilterText}
              isAdmin={isAdmin || false}
              onRefreshData={handleRefreshData}
              approvalFilter={currentApprovalFilter}
              headerAction={( 
                <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost"
                      size={isMobile ? "sm" : "default"} 
                      disabled={isActionDisabled} 
                      className={cn(
                        "border border-input hover:bg-accent hover:text-accent-foreground",
                        "text-muted-foreground",
                        isMobile ? "h-9 rounded-md px-3" : "h-10 px-4 py-2"
                      )}
                    >
                      Add New LoRA
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                    <UploadPage 
                      initialMode="lora" 
                      hideLayout={true} 
                      onSuccess={handleLoraUploadSuccess}
                    />
                  </DialogContent>
                </Dialog>
              )}
            />
            {void console.timeEnd(`${LORA_INDEX_PERF_ID_PREFIX}_Render_LoraManagerSection`)}

            {/* Pagination for LoRAs on Index Page */}
            {totalLoraDisplayPages > 1 && (
              <React.Fragment key="lora-pagination-controls">
                {renderPaginationControls(loraDisplayPage, totalLoraDisplayPages, setLoraDisplayPage)}
              </React.Fragment>
            )}

            <div className="mt-6 mb-8 flex justify-start">
              <Link
                to={currentApprovalFilter === 'all' ? "/loras?approval=all" : "/loras"}
                className="text-sm text-primary hover:underline group"
              >
                See all {currentApprovalFilter === 'curated' ? `curated ` : ''}LoRAs{' '}
                <span className="inline-block transition-transform duration-200 ease-in-out group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>

          <Separator className="mt-0 mb-4" />

          {/* Art Videos Section */}
          <div ref={artSectionRef} className="mb-8">
            <VideoGallerySection
              header="Art"
              videos={displayArtVideos.items}
              isLoading={videosLoading}
              seeAllPath={currentApprovalFilter === 'all' ? "/art?approval=all" : "/art"}
              alwaysShowInfo={true}
              emptyMessage="There's no art matching the current filter."
              showAddButton={true}
              addButtonClassification="art"
              itemsPerRow={ART_ITEMS_PER_ROW}
              onOpenLightbox={handleOpenLightbox}
              approvalFilter={currentApprovalFilter}
              headerTextClass="text-[#2F4F2E]/75"
              onUploadSuccess={handleArtUploadSuccess}
            />
            {renderPaginationControls(artPage, displayArtVideos.totalPages, handleArtPageChange)}
          </div>

          <Separator className="mt-0 mb-4" />

          {/* Generation Videos Section */}
          <div ref={generationsSectionRef} className="mb-4">
            <VideoGallerySection
              header="Generations"
              videos={displayGenVideos.items}
              isLoading={videosLoading}
              seeAllPath={currentApprovalFilter === 'all' ? "/generations?approval=all" : "/generations"}
              alwaysShowInfo={true}
              emptyMessage="There are no generations matching the current filter."
              showAddButton={true}
              addButtonClassification="gen"
              itemsPerRow={GENERATION_ITEMS_PER_ROW}
              forceCreatorHoverDesktop={true}
              onOpenLightbox={handleOpenLightbox}
              approvalFilter={currentApprovalFilter}
              headerTextClass="text-[#2F4F2E]/75"
              onUploadSuccess={handleGenerationUploadSuccess}
            />
            {renderPaginationControls(generationPage, displayGenVideos.totalPages, handleGenerationPageChange)}
          </div>
        </div>
      </div>
      
      <Footer />
      {/* Render the lightbox when a video is selected */}
      {lightboxVideo && (
        <VideoLightbox 
          isOpen={!!lightboxVideo} 
          onClose={handleCloseLightbox} 
          videoUrl={lightboxVideo.url} 
          videoId={lightboxVideo.id}
          title={lightboxVideo.metadata?.title}
          description={lightboxVideo.metadata?.description}
          initialAssetId={videoAssetMap[lightboxVideo.id]}
          thumbnailUrl={lightboxVideo.placeholder_image || lightboxVideo.metadata?.placeholder_image}
          creatorId={lightboxVideo.user_id}
          isAuthorized={isAdmin}
          adminStatus={lightboxVideo.admin_status}
          currentStatus={null}
          onStatusChange={() => Promise.resolve()}
          onAdminStatusChange={getLightboxAdminStatusChangeHandler(lightboxVideo.id)}
          onVideoUpdate={handleLightboxVideoUpdate}
          hasPrev={currentLightboxIndex > 0}
          hasNext={currentLightboxIndex !== -1 && currentLightboxIndex < lightboxVideoList.length - 1}
          onPrevVideo={handlePrevLightboxVideo}
          onNextVideo={handleNextLightboxVideo}
          classification={lightboxVideo.metadata?.classification}
        />
      )}
    </div>
  );
};

export default Index;
