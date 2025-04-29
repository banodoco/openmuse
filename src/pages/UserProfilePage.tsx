import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, UserProfile, VideoEntry, VideoDisplayStatus, UserAssetPreferenceStatus, AdminStatus } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import LoraCard from '@/components/lora/LoraCard';
import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import VideoCard from '@/components/video/VideoCard';
import VideoLightbox from '@/components/VideoLightbox';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Logger } from '@/lib/logger';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UploadPage from '@/pages/upload/UploadPage';
import LoraManager from '@/components/LoraManager';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';

const logger = new Logger('UserProfilePage');

// Define standard breakpoints
const defaultBreakpointColumnsObj = {
  default: 3,
  1100: 2,
  640: 1,
};

// Define denser breakpoints for Generations
const generationBreakpointColumnsObj = {
  default: 6,
  1100: 4,
  768: 3,
  640: 2,
};

// Helper functions (Keep these outside the component)
const calculatePageSize = (totalItems: number): number => {
  if (totalItems <= 8) return totalItems;
  if (totalItems <= 11) return 8;
  if (totalItems <= 15) return 12;
  return 16;
};

const sortProfileVideos = (videos: VideoEntry[]): VideoEntry[] => {
  const statusOrder: { [key in VideoDisplayStatus]?: number } = {
    Featured: 1,
    Curated: 2,
    Listed: 3,
    View: 4,     // Add the missing View status
    Hidden: 5,   
    Rejected: 6, 
  };
  return [...videos].sort((a, b) => {
    const statusA = a.user_status || 'Listed';
    const statusB = b.user_status || 'Listed';
    const orderA = statusOrder[statusA] || 2;
    const orderB = statusOrder[statusB] || 2;
    if (orderA !== orderB) return orderA - orderB;
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
};

const sortUserAssets = (assets: LoraAsset[]): LoraAsset[] => {
  const statusOrder: { [key in UserAssetPreferenceStatus]: number } = { 'Pinned': 1, 'Listed': 2, 'Hidden': 4 };
  return [...assets].sort((a, b) => {
    const statusA = a.user_status;
    const statusB = b.user_status;
    const orderA = statusA ? (statusOrder[statusA] ?? 3) : 3;
    const orderB = statusB ? (statusOrder[statusB] ?? 3) : 3;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

const getPaginatedItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
    // Return all items if pagination doesn't make sense (page size >= total)
    if (pageSize <= 0 || items.length <= pageSize) return items; 
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
};

const getTotalPages = (totalItems: number, pageSize: number): number => {
    if (pageSize <= 0 || totalItems <= pageSize) return 1;
    return Math.ceil(totalItems / pageSize);
};

const scrollToElementWithOffset = (element: HTMLElement | null, offset: number = -150) => {
  if (!element) return;
  const y = element.getBoundingClientRect().top + window.pageYOffset + offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
};

export default function UserProfilePage() {
  const { displayName } = useParams<{ displayName: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, isLoading: isAuthLoading } = useAuth();
  const isMobile = useIsMobile();

  // === Move ALL Hooks BEFORE the conditional return ===
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [userAssets, setUserAssets] = useState<LoraAsset[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [forceLoggedOutView, setForceLoggedOutView] = useState(false);
  const [userVideos, setUserVideos] = useState<VideoEntry[]>([]);
  const [totalGenerationVideos, setTotalGenerationVideos] = useState(0);
  const [totalArtVideos, setTotalArtVideos] = useState(0);
  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  const [initialVideoParamHandled, setInitialVideoParamHandled] = useState(false);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [isUpdatingAssetStatus, setIsUpdatingAssetStatus] = useState<Record<string, boolean>>({});
  // State for autoplay on scroll
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  // Ref for debouncing visibility changes
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Refs for scrolling pagination sections
  const generationsGridRef = useRef<HTMLDivElement>(null);
  const artGridRef = useRef<HTMLDivElement>(null);
  const lorasGridRef = useRef<HTMLDivElement>(null); // Add ref for LoRAs too
  // Refs for the parent Cards that will fade in
  const loraCardRef = useRef<HTMLDivElement>(null);
  const artCardRef = useRef<HTMLDivElement>(null);
  const generationsCardRef = useRef<HTMLDivElement>(null);

  // Pagination State
  const [generationPage, setGenerationPage] = useState(1);
  const [artPage, setArtPage] = useState(1);
  const [loraPage, setLoraPage] = useState(1);

  // Add a ref to track mounted state for cleanup
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      // Clear any pending timeout on unmount
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, []);

  // Modal State
  const [isLoraUploadModalOpen, setIsLoraUploadModalOpen] = useState(false);
  const [isGenerationUploadModalOpen, setIsGenerationUploadModalOpen] = useState(false);
  const [isArtUploadModalOpen, setIsArtUploadModalOpen] = useState(false);

  // Only this flag (not the whole query string) should trigger data refetch
  const loggedOutViewParam = searchParams.get('loggedOutView');

  // --- Data Fetching Functions defined using useCallback ---
  const fetchUserAssets = useCallback(async (profileUserId: string, canViewerSeeHiddenAssets: boolean, page: number) => {
    logger.log('[fetchUserAssets] Fetching page...', { profileUserId, canViewerSeeHiddenAssets, page });
    setIsLoadingAssets(true);
    const pageSize = 16; // Use a fixed page size
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    try {
      // Fetch count and data in one query
      const { data: assetsData, error: assetsError, count } = await supabase
        .from('assets')
        .select(`*, primaryVideo:primary_media_id(*)`, { count: 'exact' }) // Get total count
        .eq('user_id', profileUserId)
        .order('created_at', { ascending: false }) // Keep sorting consistent if needed, or sort server-side by status first
        .range(rangeFrom, rangeTo); // Fetch specific page range

      if (assetsError) throw assetsError;

      if (assetsData) {
        const processedAssets: LoraAsset[] = assetsData.map((asset: any) => {
           const pVideo = asset.primaryVideo;
           const userStatus = asset.user_status as UserAssetPreferenceStatus | null;
           return {
             id: asset.id,
             name: asset.name,
             description: asset.description,
             creator: asset.creator,
             type: asset.type,
             created_at: asset.created_at,
             user_id: asset.user_id,
             primary_media_id: asset.primary_media_id,
             admin_status: asset.admin_status,
             user_status: userStatus,
             lora_type: asset.lora_type,
             lora_base_model: asset.lora_base_model,
             model_variant: asset.model_variant,
             lora_link: asset.lora_link,
             primaryVideo: pVideo ? { 
               id: pVideo.id,
               url: pVideo.url,
               reviewer_name: pVideo.creator || '',
               skipped: false,
               created_at: pVideo.created_at,
               admin_status: pVideo.admin_status,
               user_id: pVideo.user_id,
               user_status: pVideo.user_status || null,
               metadata: {
                 title: pVideo.title || asset.name,
                 placeholder_image: pVideo.placeholder_image || null,
                 description: pVideo.description,
                 creator: pVideo.creator ? 'self' : undefined,
                 creatorName: pVideo.creator_name,
                 classification: pVideo.classification,
                 loraName: asset.name,
                 assetId: asset.id,
                 loraType: asset.lora_type,
                 model: asset.lora_base_model,
                 modelVariant: asset.model_variant,
               }
             } : undefined
           };
        });
        
        const visibleAssets = canViewerSeeHiddenAssets
          ? processedAssets
          : processedAssets.filter(asset => asset.user_status !== 'Hidden');
        const sortedPageAssets = sortUserAssets(visibleAssets);
        setUserAssets(sortedPageAssets);
        setTotalAssets(count ?? 0);
      } else {
         setUserAssets([]);
         setTotalAssets(0);
      }
    } catch (err: any) {
      logger.error('[fetchUserAssets] Error fetching user assets:', err);
      toast.error("Failed to load LoRAs.");
      setUserAssets([]);
      setTotalAssets(0);
    } finally {
        setIsLoadingAssets(false);
    }
  }, []); // Dependencies likely needed: supabase

  const fetchUserVideos = useCallback(async (
    userId: string,
    currentViewerId: string | null | undefined,
    isViewerAdmin: boolean,
    showLoading: boolean = true,
  ) => {
    logger.log('[fetchUserVideos] Fetching videos...', { userId, currentViewerId, isViewerAdmin, showLoading });
    if (showLoading) {
      setIsLoadingVideos(true);
    }
    let fetchedVideos: VideoEntry[] = []; 
    let generationCount = 0;
    let artCount = 0;
    try {
      const { data: videosData, error: videosError, count } = await supabase
        .from('media')
        .select('* ', { count: 'exact' })
        .eq('user_id', userId)
        .eq('type', 'video');

      if (videosError) throw videosError;

      if (videosData && videosData.length > 0) {
          const videoIds = videosData.map(v => v.id);
          const mediaIdToAssetId = new Map<string, string>();
          if (videoIds.length > 0) {
            const { data: assetLinks, error: linksError } = await supabase
              .from('asset_media')
              .select('media_id, asset_id')
              .in('media_id', videoIds);
            if (linksError) {
              logger.error('Error fetching asset_media links:', linksError);
            } else if (assetLinks) {
              assetLinks.forEach(link => {
                if (link.media_id && link.asset_id) {
                  mediaIdToAssetId.set(link.media_id, link.asset_id);
                }
              });
            }
          }
          const processedVideos: VideoEntry[] = videosData.map(video => {
            let classification = video.classification || 'gen';
            if (classification !== 'art' && classification !== 'gen') {
              classification = 'gen';
            }
            const associatedAssetId = mediaIdToAssetId.get(video.id) || null;
            return {
              id: video.id,
              url: video.url,
              associatedAssetId: associatedAssetId,
              reviewer_name: video.creator || '',
              skipped: false,
              created_at: video.created_at,
              admin_status: video.admin_status,
              user_status: video.user_status as VideoDisplayStatus || null,
              assetMediaDisplayStatus: null,
              user_id: video.user_id,
              metadata: {
                title: video.title || '',
                description: video.description || '',
                creator: 'self',
                classification: classification as 'art' | 'gen',
                placeholder_image: video.placeholder_image,
                assetId: associatedAssetId,
              },
              thumbnailUrl: video.placeholder_image,
              title: video.title || '',
              description: video.description || '',
              is_primary: false,
              aspectRatio: (video.metadata as any)?.aspectRatio || 16/9,
              classification: (video.classification as 'art' | 'gen') || 'gen',
            };
          }).filter(Boolean) as VideoEntry[];

          const isViewerOwner = currentViewerId === userId;
          const canViewerSeeHidden = isViewerOwner || isViewerAdmin;
          const visibleVideos = processedVideos.filter(video =>
            canViewerSeeHidden || video.user_status !== 'Hidden'
          );
          fetchedVideos = sortProfileVideos(visibleVideos);
          generationCount = fetchedVideos.filter(v => v.metadata?.classification === 'gen').length;
          artCount = fetchedVideos.filter(v => v.metadata?.classification === 'art').length;
      } else {
          generationCount = 0;
          artCount = 0;
      }
    } catch (err: any) {
      logger.error('[fetchUserVideos] Error fetching user videos:', err);
      toast.error("Failed to load videos.");
    } finally {
        setUserVideos(fetchedVideos);
        setTotalGenerationVideos(generationCount);
        setTotalArtVideos(artCount);
        if (showLoading) {
          setIsLoadingVideos(false);
        }
    }
  }, []); // Dependencies likely needed: supabase

  // --- ADDED: Moved and wrapped handleOpenLightbox ---
  const handleOpenLightbox = useCallback((video: VideoEntry) => {
    setLightboxVideo(video);
    setInitialVideoParamHandled(true);
    // Add history push state here if needed to update URL without reload
    // window.history.pushState({}, '', `${window.location.pathname}?video=${video.id}`);
  }, [setLightboxVideo, setInitialVideoParamHandled]); // Dependencies are stable setters

  // --- Main Data Fetching Effect ---
  useEffect(() => {
    logger.log("Main data fetching effect triggered", { displayName, isAuthLoading, userId: user?.id, isAdmin, loggedOutViewParam });
    if (isAuthLoading) {
      logger.log("Auth is loading, deferring profile fetch...");
      return; // Don't proceed until auth is resolved
    }
    // Define isMounted flag here, in the useEffect scope
    let isMounted = true;

    // Determine if user should see the public view
    const forcePublic = loggedOutViewParam === 'true';
    setForceLoggedOutView(forcePublic);

    const fetchProfileAndInitialData = async () => {
      if (!displayName) {
        logger.warn("No displayName in URL parameters, cannot fetch profile.");
        setIsLoadingProfile(false);
        setProfile(null);
        setUserAssets([]);
        setUserVideos([]);
        return;
      }
      
      logger.log("Fetching profile for displayName:", displayName);
      setIsLoadingProfile(true);
      setIsLoadingAssets(true);
      setIsLoadingVideos(true);

      try {
        // Fetch profile by username (which is unique)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', displayName) // Use username (unique) instead of display_name
          .single();

        // Use the isMounted flag defined in the outer scope
        if (!isMounted) return;

        if (profileError) {
          if (profileError.code === 'PGRST116') { // Resource Not Found
            logger.warn(`Profile not found for username: ${displayName}`);
            toast.error("User profile not found.");
          } else {
            logger.error(`Error fetching profile for ${displayName}:`, profileError);
            toast.error("Failed to load profile information.");
          }
          setProfile(null);
          setIsLoadingProfile(false);
          setIsLoadingAssets(false);
          setIsLoadingVideos(false);
          navigate('/', { replace: true }); // Redirect if profile not found/error
          return;
        }

        if (profileData) {
          logger.log("Profile found:", profileData.id);
          setProfile(profileData);
          const ownerStatus = !forcePublic && user?.id === profileData.id;
          const editStatus = !forcePublic && (ownerStatus || isAdmin);
          setIsOwner(ownerStatus);
          setCanEdit(editStatus);
          logger.log("Profile owner/edit status determined", { ownerStatus, editStatus });

          // Now fetch assets and videos associated with this profile ID
          const profileUserId = profileData.id;
          // Fetch assets and videos CONCURRENTLY 
          // Pass editStatus to determine if hidden items should be fetched/shown
          await Promise.all([
            fetchUserAssets(profileUserId, editStatus, loraPage), // Initial fetch uses loraPage
            fetchUserVideos(profileUserId, user?.id, isAdmin) // Pass viewer context
          ]);
          logger.log("Initial asset and video fetch complete for profile:", profileUserId);
          
          // Handle initial video param after data is loaded
          const videoParam = searchParams.get('video');
          if (videoParam && !initialVideoParamHandled) {
             // Re-fetch the latest videos state before finding the video
            const currentVideos = userVideos; // Assuming fetchUserVideos updated state
            const found = currentVideos.find(v => v.id === videoParam);
            if (found) {
              handleOpenLightbox(found);
              setInitialVideoParamHandled(true);
            } else {
              logger.warn(`Video ID ${videoParam} from URL not found in user's videos.`);
            }
          }

        } else {
          logger.warn(`Profile data unexpectedly null for username: ${displayName}`);
          setProfile(null);
          setIsOwner(false);
          setCanEdit(false);
          navigate('/', { replace: true });
        }
      } catch (err) {
        if (isMounted) {
          logger.error('General error in fetchProfileAndInitialData:', err);
          toast.error("An error occurred while loading the profile.");
          setProfile(null);
          setIsOwner(false);
          setCanEdit(false);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    if (displayName) {
      fetchProfileAndInitialData();
    } else {
      logger.warn("No displayName in URL parameter, skipping fetch.");
      setIsLoadingProfile(false);
      setProfile(null);
    }

    return () => { 
      isMounted = false;
      logger.log("Main data fetching effect cleanup");
    };
    // DEPENDENCIES: Ensure all external variables used are listed
  }, [displayName, user, isAdmin, isAuthLoading, loggedOutViewParam, fetchUserAssets, fetchUserVideos, loraPage, navigate]);

  // --- Derived State with useMemo ---
  const generationVideos = useMemo(() => userVideos.filter(v => v.metadata?.classification === 'gen'), [userVideos]);
  const artVideos = useMemo(() => userVideos.filter(v => v.metadata?.classification === 'art'), [userVideos]);
  const loraPageSize = useMemo(() => calculatePageSize(userAssets.length), [userAssets.length]);
  const generationPageSize = useMemo(() => {
    const calc = calculatePageSize(generationVideos.length);
    return Math.min(calc, 12);
  }, [generationVideos.length]);
  const artPageSize = useMemo(() => calculatePageSize(artVideos.length), [artVideos.length]);
  const totalLoraPages = useMemo(() => getTotalPages(userAssets.length, loraPageSize), [userAssets.length, loraPageSize]);
  const totalGenerationPages = useMemo(() => getTotalPages(generationVideos.length, generationPageSize), [generationVideos.length, generationPageSize]);
  const totalArtPages = useMemo(() => getTotalPages(artVideos.length, artPageSize), [artVideos.length, artPageSize]);
  const loraItemsForPage = useMemo(() => getPaginatedItems(userAssets, loraPage, loraPageSize), [userAssets, loraPage, loraPageSize]);
  const generationItemsForPage = useMemo(() => getPaginatedItems(generationVideos, generationPage, generationPageSize), [generationVideos, generationPage, generationPageSize]);
  const artItemsForPage = useMemo(() => getPaginatedItems(artVideos, artPage, artPageSize), [artVideos, artPage, artPageSize]);

  // --- Define ALL useCallback Handlers BEFORE conditional return ---
  const handleLocalVideoUserStatusUpdate = useCallback((videoId: string, newStatus: VideoDisplayStatus) => {
    logger.log(`[UserProfilePage] handleLocalVideoUserStatusUpdate called for video ${videoId} with status ${newStatus}`);
    setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === videoId ? { ...video, user_status: newStatus } : video)));
    logger.log(`[UserProfilePage] Local video state (userVideos) updated for ${videoId}`);
  }, []); 

  const handleLightboxUserStatusChange = useCallback(async (newStatus: VideoDisplayStatus): Promise<void> => {
    if (!lightboxVideo) { toast.error("Cannot update status: Video info missing."); return; }
    const videoId = lightboxVideo.id;
    try {
      const { error } = await supabase.from('media').update({ user_status: newStatus }).eq('id', videoId);
      if (error) throw error;
      toast.success(`Video status updated to ${newStatus}`);
      handleLocalVideoUserStatusUpdate(videoId, newStatus);
      setLightboxVideo(prev => prev ? { ...prev, user_status: newStatus } : null);
    } catch (error) {
      logger.error(`Failed to update video user_status for media ID ${videoId}:`, error);
      toast.error('Failed to update video status');
    }
  }, [lightboxVideo, handleLocalVideoUserStatusUpdate]); 

  const handleLightboxAdminStatusChange = useCallback(async (newStatus: AdminStatus): Promise<void> => {
    if (!lightboxVideo) { toast.error("Cannot update status: Video info missing."); return; }
    // Note: We use profile.id for ownership checks, but isAdmin comes directly from useAuth context
    // Check if the *current logged-in user* (from useAuth) is an admin, regardless of profile ownership
    const loggedInUserIsAdmin = isAdmin; 
    // Allow edit if owner OR if the logged-in user is admin (and not forced logged out view)
    const canPerformAdminAction = (isOwner || loggedInUserIsAdmin) && !forceLoggedOutView;

    if (!canPerformAdminAction) { 
      toast.error("Unauthorized action."); 
      return; 
    } 
    const videoId = lightboxVideo.id;
    try {
      const { error } = await supabase.from('media').update({ admin_status: newStatus, admin_reviewed: true }).eq('id', videoId);
      if (error) throw error;
      toast.success(`Video admin status updated to ${newStatus}`);
      // Update local state using setUserVideos (which is stable)
      setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === videoId ? { ...video, admin_status: newStatus } : video)));
      setLightboxVideo(prev => prev ? { ...prev, admin_status: newStatus } : null);
    } catch (error) {
      logger.error(`Failed to update video admin_status for media ID ${videoId}:`, error);
      toast.error('Failed to update video admin status');
    }
    // Dependencies: lightboxVideo (state), isAdmin (context), isOwner (state), forceLoggedOutView (state), setUserVideos (stable state setter)
  }, [lightboxVideo, isAdmin, isOwner, forceLoggedOutView]); 

  const deleteVideo = useCallback(async (videoId: string): Promise<void> => {
    // Allow delete if owner OR admin (and not forced logged out view)
    const loggedInUserIsAdmin = isAdmin; 
    const canPerformDelete = (isOwner || loggedInUserIsAdmin) && !forceLoggedOutView;
    if (!canPerformDelete) { toast.error("Unauthorized action."); return; }
    try {
      const { data: mediaRecord, error: fetchError } = await supabase.from('media').select('url, placeholder_image').eq('id', videoId).single();
      if (fetchError || !mediaRecord) throw new Error(`Could not fetch media record ${videoId}.`);
      const extractRelativePath = (url: string | null | undefined, bucketName: string): string | null => { 
         if (!url) return null; try { const u = new URL(url); const p = u.pathname.split('/'); const i = p.findIndex(s => s === bucketName); if (i !== -1 && i + 1 < p.length) return p.slice(i + 1).join('/'); } catch (e) { /* ignore */ } return null;
       };
      const storagePromises = [];
      const videoPath = extractRelativePath(mediaRecord.url, 'videos');
      if (videoPath) storagePromises.push(supabase.storage.from('videos').remove([videoPath]));
      const thumbPath = extractRelativePath(mediaRecord.placeholder_image, 'thumbnails');
      if (thumbPath) storagePromises.push(supabase.storage.from('thumbnails').remove([thumbPath]));
      Promise.allSettled(storagePromises).then(results => 
         results.forEach((result, index) => { if (result.status === 'rejected') logger.warn(`Storage deletion promise ${index} failed:`, result.reason); }) 
      );
      const { error: dbError } = await supabase.from('media').delete().eq('id', videoId);
      if (dbError) throw dbError;
      setUserVideos(prev => sortProfileVideos(prev.filter(video => video.id !== videoId)));
      toast.success('Video deleted successfully');
    } catch (error: any) {
      logger.error(`Error during deletion process for video ID ${videoId}:`, error);
      toast.error(`Failed to delete video: ${error.message || 'Unknown error'}`);
    }
    // Dependencies: isAdmin (context), isOwner (state), forceLoggedOutView (state), setUserVideos (stable state setter)
  }, [isAdmin, isOwner, forceLoggedOutView]); 

  const approveVideo = useCallback(async (id: string): Promise<void> => {
    const loggedInUserIsAdmin = isAdmin; 
    const canPerformAdminAction = loggedInUserIsAdmin && !forceLoggedOutView;
    if (!canPerformAdminAction) return;
    try {
      await supabase.from('media').update({ admin_status: 'Curated', admin_reviewed: true }).eq('id', id);
      setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Curated' as AdminStatus } : video)));
      toast.success("Video Approved (Curated)");
    } catch (error) { 
        logger.error('Error approving video:', error);
        toast.error("Failed to approve video."); 
    }
    // Dependencies: isAdmin (context), forceLoggedOutView (state), setUserVideos (stable state setter)
  }, [isAdmin, forceLoggedOutView]); 

  const rejectVideo = useCallback(async (id: string): Promise<void> => {
    const loggedInUserIsAdmin = isAdmin; 
    const canPerformAdminAction = loggedInUserIsAdmin && !forceLoggedOutView;
    if (!canPerformAdminAction) return;
    try {
      await supabase.from('media').update({ admin_status: 'Rejected', admin_reviewed: true }).eq('id', id);
      setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Rejected' as AdminStatus } : video)));
      toast.success("Video Rejected");
    } catch (error) { 
        logger.error('Error rejecting video:', error);
        toast.error("Failed to reject video."); 
    }
    // Dependencies: isAdmin (context), forceLoggedOutView (state), setUserVideos (stable state setter)
  }, [isAdmin, forceLoggedOutView]); 

  const handleAssetStatusUpdate = useCallback(async (assetId: string, newStatus: UserAssetPreferenceStatus): Promise<void> => {
    // Check ownership based on the fetched profile and the logged-in user
    if (!user || !profile || user.id !== profile.id) { toast.error("Unauthorized action."); return; } 
    let optimisticPreviousStatus: UserAssetPreferenceStatus | null | undefined = undefined;
    setUserAssets(prevAssets => {
      const updatedAssets = prevAssets.map(asset => {
        if (asset.id === assetId) { 
            optimisticPreviousStatus = asset.user_status; 
            return { ...asset, user_status: newStatus }; 
        }
        return asset;
      });
      return sortUserAssets(updatedAssets);
    });
    setIsUpdatingAssetStatus(prev => ({ ...prev, [assetId]: true }));
    try {
      const { error } = await supabase.from('assets').update({ user_status: newStatus }).eq('id', assetId);
      if (error) throw error;
      toast.success(`Asset status updated to ${newStatus}`);
    } catch (error) {
      logger.error(`Error updating asset ${assetId} status to ${newStatus} in DB:`, error);
      toast.error(`Failed to update status to ${newStatus}. Reverting.`);
      setUserAssets(prevAssets => 
        sortUserAssets(prevAssets.map(asset => 
          asset.id === assetId ? { ...asset, user_status: optimisticPreviousStatus } : asset
        ))
      );
    } finally {
      setIsUpdatingAssetStatus(prev => ({ ...prev, [assetId]: false }));
    }
    // Dependencies: user (context), profile (state), setUserAssets (stable state setter)
  }, [user, profile]); 

  // Callback for video visibility changes - with debounce
  const handleVideoVisibilityChange = useCallback((videoId: string, isVisible: boolean) => {
    logger.log(`UserProfilePage: Visibility change reported for ${videoId}: ${isVisible}`);
    
    // Clear any existing timeout when visibility changes for *any* card
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = null;
    }

    if (isVisible) {
      // If a video becomes visible, set a timeout to make it the active one
      visibilityTimeoutRef.current = setTimeout(() => {
        if (!unmountedRef.current) { // Check if component is still mounted
          logger.log(`UserProfilePage: Debounced - Setting visible video to ${videoId}`);
          setVisibleVideoId(videoId);
        }
      }, 150); // 150ms debounce delay
    } else {
      // If a video becomes hidden, check if it was the currently active one
      setVisibleVideoId(prevVisibleId => {
        if (prevVisibleId === videoId) {
          logger.log(`UserProfilePage: Clearing visible video ${videoId} (became hidden)`);
          return null; // Clear the active video ID immediately
        }
        return prevVisibleId; // Otherwise, keep the current state
      });
    }
  }, []); // Empty dependency array as it uses refs and state setters

  const handleLoraUploadSuccess = useCallback(() => {
    setIsLoraUploadModalOpen(false);
    // Refetch assets for the current profile after successful upload
    if (profile?.id) {
      const canSeeHidden = (user?.id === profile.id) || isAdmin;
      // Fetch the first page again
      fetchUserAssets(profile.id, canSeeHidden, 1);
    }
  }, [profile, user, isAdmin, fetchUserAssets]);

  // Add success handlers for media uploads
  const handleGenerationUploadSuccess = useCallback(() => {
    setIsGenerationUploadModalOpen(false);
    if (profile?.id) {
      // Use false for showLoading to avoid jarring reload
      fetchUserVideos(profile.id, user?.id, isAdmin, false); 
    }
  }, [profile, user, isAdmin, fetchUserVideos]);

  const handleArtUploadSuccess = useCallback(() => {
    setIsArtUploadModalOpen(false);
    if (profile?.id) {
      fetchUserVideos(profile.id, user?.id, isAdmin, false); 
    }
  }, [profile, user, isAdmin, fetchUserVideos]);

  // Use the FULL lists (generationVideos, artVideos) for lightbox navigation
  const fullVideoListForLightbox = useMemo(() => {
    // Combine the full, unsorted, unpaginated lists, ensuring arrays are used
    const gen = Array.isArray(generationVideos) ? generationVideos : [];
    const art = Array.isArray(artVideos) ? artVideos : [];
    return [...gen, ...art];
  }, [generationVideos, artVideos]); // Depend on the state variables holding the full lists

  // Find the index in the FULL list
  const currentLightboxIndex = useMemo(() => {
    if (!lightboxVideo) return -1;
    return fullVideoListForLightbox.findIndex(v => v.id === lightboxVideo.id);
  }, [lightboxVideo, fullVideoListForLightbox]);

  // Handlers now use the FULL list
  const handlePrevLightboxVideo = useCallback(() => {
    if (currentLightboxIndex > 0) {
      setLightboxVideo(fullVideoListForLightbox[currentLightboxIndex - 1]);
    }
  }, [currentLightboxIndex, fullVideoListForLightbox, setLightboxVideo]); // Added setLightboxVideo dependency

  const handleNextLightboxVideo = useCallback(() => {
    if (currentLightboxIndex !== -1 && currentLightboxIndex < fullVideoListForLightbox.length - 1) {
      setLightboxVideo(fullVideoListForLightbox[currentLightboxIndex + 1]);
    }
  }, [currentLightboxIndex, fullVideoListForLightbox, setLightboxVideo]); // Added setLightboxVideo dependency

  // --------------------------------------------------
  // Auto-open lightbox when ?video=<id> is present
  // --------------------------------------------------
  useEffect(() => {
    const videoParam = searchParams.get('video');
    if (!videoParam) return;

    if (initialVideoParamHandled) return;
    if (lightboxVideo && lightboxVideo.id === videoParam) return;
    // Check userVideos state directly, which should be up-to-date
    if (userVideos && userVideos.length > 0) {
      const found = userVideos.find(v => v.id === videoParam);
      if (found) {
        handleOpenLightbox(found); // Use the stable callback
      }
    }
    // Dependencies updated
  }, [searchParams, lightboxVideo, initialVideoParamHandled, userVideos, handleOpenLightbox]);

  // Apply fade-in on scroll to major sections
  useFadeInOnScroll(loraCardRef);
  useFadeInOnScroll(artCardRef);
  useFadeInOnScroll(generationsCardRef);

  logger.log(`[UserProfilePage Render Start] isAuthLoading: ${isAuthLoading}, user ID: ${user?.id}`);

  // === Early return if AuthProvider is still loading ===
  if (isAuthLoading) {
    logger.log('[UserProfilePage Render] Returning loader because isAuthLoading is true.');
    return (
      <div className="w-full min-h-screen flex flex-col text-foreground">
        <Navigation />
        <main className="flex-1 container mx-auto p-4 md:p-6 flex justify-center items-center">
          {/* Render a top-level loader */}
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }
  logger.log('[UserProfilePage Render] Proceeding past auth loading check.');

  // --- Helper Functions Defined Inside Component ---
  const getInitials = (name: string) => {
    return name?.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2) || '??';
  };

  // --- UI Event Handlers (Keep these) ---
  const handleGenerationPageChange = (newPage: number) => {
    scrollToElementWithOffset(generationsGridRef.current);
    setTimeout(() => { if (!unmountedRef.current) setGenerationPage(newPage); }, 300);
  };
  const handleArtPageChange = (newPage: number) => {
    scrollToElementWithOffset(artGridRef.current);
    setTimeout(() => { if (!unmountedRef.current) setArtPage(newPage); }, 300);
  };
  const handleLoraPageChange = (newPage: number) => {
    scrollToElementWithOffset(lorasGridRef.current);
    setTimeout(() => { if (!unmountedRef.current) setLoraPage(newPage); }, 300);
  };
  const handleCloseLightbox = () => setLightboxVideo(null);
  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    setHoveredVideoId(isHovering ? videoId : null);
  };

  // --- Constants defined inside component (Keep these) ---
   const breakpointColumnsObj = { default: 4, 1100: 3, 700: 2, 500: 1 };

  // --- Render Helper functions inside component (Keep these) ---
  const renderProfileLinks = () => {
    if (!profile?.links || profile.links.length === 0) return null; 
    return ( 
      <div className="flex flex-wrap gap-3 mt-4 justify-center"> 
        {profile.links.map((link, index) => { 
          try { const url = new URL(link); const domain = url.hostname; 
            return ( 
              <HoverCard key={index}> <HoverCardTrigger asChild> 
                  <a href={link} target="_blank" rel="noopener noreferrer" className="relative flex items-center justify-center w-10 h-10 bg-accent/30 hover:bg-accent/50 rounded-full transition-colors shadow-sm hover:shadow-md"> 
                    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-5 h-5" /> 
                  </a> 
              </HoverCardTrigger> <HoverCardContent className="p-2 text-sm glass"> {domain} </HoverCardContent> </HoverCard> ); 
          } catch (e) { return null; } 
        })} 
      </div> ); 
  };

  const renderPaginationControls = (
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void,
  ) => {
    if (totalPages <= 1) return null; 
    return ( 
      <Pagination className="mt-6"> <PaginationContent> 
          <PaginationItem> <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (currentPage > 1) { onPageChange(currentPage - 1); } }} aria-disabled={currentPage === 1} className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined} /> </PaginationItem> 
          {[...Array(totalPages)].map((_, i) => { const page = i + 1; 
            if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) { return ( <PaginationItem key={page}> <PaginationLink href="#" onClick={(e) => { e.preventDefault(); onPageChange(page); }} isActive={page === currentPage}> {page} </PaginationLink> </PaginationItem> ); } 
            else if (Math.abs(page - currentPage) === 2) { return <PaginationEllipsis key={`ellipsis-${page}`} />; } 
            return null; 
          })} 
          <PaginationItem> <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) { onPageChange(currentPage + 1); } }} aria-disabled={currentPage === totalPages} className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined} /> </PaginationItem> 
      </PaginationContent> </Pagination> ); 
  };

  // Add the following useMemo hook along with other useMemo hooks, e.g., after the declarations of userVideos and userAssets:

  const featuredCount = useMemo(() => {
    const videoFeatured = userVideos.filter(v => v.admin_status === 'Curated' || v.admin_status === 'Featured').length;
    const assetFeatured = userAssets.filter(a => a.admin_status === 'Curated' || a.admin_status === 'Featured').length;
    return videoFeatured + assetFeatured;
  }, [userVideos, userAssets]);

  // --- JSX Rendering ---
  return (
    <div className="w-full min-h-screen flex flex-col text-foreground">
       <Helmet>
         <title>{profile ? `${profile.display_name || profile.username}'s Profile` : 'User Profile'} | OpenMuse</title>
        <meta name="description" content={profile?.description ? profile.description.substring(0, 160) : `View the profile, LoRAs, and videos created by ${profile?.display_name || profile?.username || 'this user'} on OpenMuse.`} />
        <meta property="og:type" content="profile" /> <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={profile ? `${profile.display_name || profile.username}'s Profile | OpenMuse` : 'User Profile | OpenMuse'} />
        <meta property="og:description" content={profile?.description ? profile.description.substring(0, 160) : `View the profile, LoRAs, and videos created by ${profile?.display_name || profile?.username || 'this user'} on OpenMuse.`} />
        <meta property="og:image" content={profile?.background_image_url || profile?.avatar_url || '/placeholder.svg'} /> {profile?.username && <meta property="profile:username" content={profile.username} />} 
        <meta name="twitter:card" content="summary_large_image" /> <meta name="twitter:url" content={window.location.href} />
        <meta name="twitter:title" content={profile ? `${profile.display_name || profile.username}'s Profile | OpenMuse` : 'User Profile | OpenMuse'} />
        <meta name="twitter:description" content={profile?.description ? profile.description.substring(0, 160) : `View the profile, LoRAs, and videos created by ${profile?.display_name || profile?.username || 'this user'} on OpenMuse.`} />
        <meta name="twitter:image" content={profile?.background_image_url || profile?.avatar_url || '/placeholder.svg'} />
      </Helmet>

      <Navigation />
      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
        <PageHeader title="" description="" />

        {isLoadingProfile ? (
          <div className="flex justify-center items-center py-16"> <Loader2 className="h-16 w-16 animate-spin text-primary" /> </div>
        ) : !profile || !profile.id || !profile.username ? (
          <div className="text-center py-16 text-muted-foreground"> Profile not found or failed to load. </div>
        ) : (
          <>
            <div className="max-w-2xl mx-auto">
              {isOwner && !forceLoggedOutView ? ( <UserProfileSettings /> ) : ( 
                <Card className="w-full overflow-hidden shadow-lg bg-white/10 backdrop-blur-sm border border-white/20 animate-scale-in"> 
                  {profile.background_image_url && <div className="w-full h-48 bg-cover bg-center rounded-t-lg" style={{ backgroundImage: `url(${profile.background_image_url})` }} />} 
                  <CardContent className={`pt-6 pb-4 ${profile.background_image_url ? '-mt-16 relative z-10 bg-gradient-to-t from-card to-transparent' : ''}`}> 
                    <div className="flex flex-col items-center space-y-4"> 
                      <Avatar className={`h-24 w-24 border-4 border-white shadow-xl ${profile.background_image_url ? '-mt-13' : ''}`}> 
                        <AvatarImage src={profile.avatar_url || ''} alt={profile.display_name || ''} /> 
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white"> {getInitials(profile.display_name || profile.username)} </AvatarFallback> 
                      </Avatar> 
                      <div className="text-center"> 
                        <div className="flex items-center justify-center space-x-2">
                          <h2 className="text-2xl font-bold bg-gradient-to-r from-forest-dark to-olive-dark bg-clip-text text-transparent">{profile.display_name}</h2>
                          {featuredCount > 0 && (
                            <HoverCard openDelay={0} closeDelay={0}>
                              <HoverCardTrigger asChild>
                                <img src="/reward.png" alt="Featured" className="h-6 w-6 rounded-full" />
                              </HoverCardTrigger>
                              <HoverCardContent 
                                className="p-2 text-sm w-fit min-w-0" 
                                side="top" 
                                align="start" 
                                sideOffset={5}
                              >
                                {`Featured ${featuredCount} ${featuredCount === 1 ? 'time' : 'times'}`}
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </div>
                        {profile.real_name && <p className="text-muted-foreground mt-1">{profile.real_name}</p>} 
                        <p className="text-muted-foreground text-sm">
                          {!isOwner && <span className="mr-0.5">@</span>}{profile.username}
                        </p>
                        {profile.description && <div className="mt-4 max-w-md mx-auto"> <p className="text-sm text-foreground/90 bg-muted/20 p-3 rounded-lg">{profile.description}</p> </div>} 
                        {renderProfileLinks()} 
                      </div> 
                    </div> 
                  </CardContent> 
                </Card> 
              )} 
            </div>

            <Card ref={loraCardRef} className="mt-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-cream-light/70 backdrop-blur-sm border border-cream-dark/20">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-amber-50 to-transparent rounded-t-md">
                <CardTitle className="text-[#2F4F2E]/75">LoRAs</CardTitle>
                {isOwner && !forceLoggedOutView && (
                  <Dialog open={isLoraUploadModalOpen} onOpenChange={setIsLoraUploadModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-forest to-olive hover:from-forest-dark hover:to-olive-dark transition-all duration-300" size="sm">
                        Add LoRA
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-lg w-[90vw] max-w-[90vw] sm:max-w-[80vw] max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                      <DialogHeader>
                        <DialogTitle>Add LoRA</DialogTitle>
                      </DialogHeader>
                      <UploadPage 
                        initialMode="lora" 
                        defaultClassification="gen" 
                        hideLayout={true} 
                        onSuccess={handleLoraUploadSuccess}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent ref={lorasGridRef} className="p-4 md:p-6 pt-6">
                {isLoadingAssets ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                 userAssets.length > 0 ? ( <> 
                    <LoraManager
                      loras={loraItemsForPage} 
                      isLoading={isLoadingAssets} // Reflect LoRA loading state
                      lorasAreLoading={isLoadingAssets} // Pass same state
                      isAdmin={canEdit} // Use calculated edit permission
                      onUserStatusChange={handleAssetStatusUpdate} // Pass status update handler
                      isUpdatingStatusMap={isUpdatingAssetStatus} // Pass map of updating statuses
                      showSeeAllLink={false} // Don't show "See All" on profile
                      showHeader={false} // Hide the internal LoraManager header on the profile page
                      hideCreatorInfo={true}
                      // Omit filterText, onFilterTextChange, onRefreshData, onNavigateToUpload
                      // Omit hideCreatorInfo (handled by LoraManager or default)
                      // Omit visibility/autoplay props for now
                    />
                    {totalLoraPages > 1 && renderPaginationControls(loraPage, totalLoraPages, handleLoraPageChange)} </> 
                ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't created any LoRAs yet. </div> )} 
              </CardContent>
            </Card>
            <Card ref={artCardRef} className="mt-8 mb-8 overflow-visible shadow-lg bg-gradient-to-br from-card to-olive-light/30 backdrop-blur-sm border border-olive-dark/20">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-amber-50 to-transparent rounded-t-md">
                <CardTitle className="text-[#2F4F2E]/75">Art</CardTitle>
                {isOwner && !forceLoggedOutView && (
                   <Dialog open={isArtUploadModalOpen} onOpenChange={setIsArtUploadModalOpen}>
                     <DialogTrigger asChild>
                       <Button size="sm" className="bg-gradient-to-r from-olive-dark to-olive hover:opacity-90 transition-all duration-300">
                         Add Art
                       </Button>
                     </DialogTrigger>
                     <DialogContent className="rounded-lg w-[90vw] max-w-[90vw] sm:max-w-[80vw] max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                       <DialogHeader>
                         <DialogTitle>Upload Art</DialogTitle>
                       </DialogHeader>
                       <UploadPage 
                         initialMode="media" 
                         defaultClassification="art" 
                         hideLayout={true} 
                         onSuccess={handleArtUploadSuccess}
                       />
                     </DialogContent>
                   </Dialog>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                 {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 4} /> ) : 
                  artVideos.length > 0 ? ( <> 
                    <div ref={artGridRef}> {/* Removed -mt-10 wrapper */}
                      <VideoGallerySection 
                        header="" // No need for header title inside card
                        videos={artItemsForPage}
                        itemsPerRow={4} // Match Index page
                        isLoading={isLoadingVideos}
                        isAdmin={canEdit}
                        isAuthorized={canEdit}
                        compact={true} // Use compact mode inside card
                        onOpenLightbox={handleOpenLightbox}
                        onApproveVideo={approveVideo}
                        onRejectVideo={rejectVideo}
                        onDeleteVideo={deleteVideo}
                        onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate}
                        alwaysShowInfo={true} // Always show on profile
                        // Don't show add button or see all link here
                        showAddButton={false}
                        seeAllPath=""
                        emptyMessage="This user hasn't added any art yet." // Custom empty message
                      />
                    </div>
                    {totalArtPages > 1 && renderPaginationControls(artPage, totalArtPages, handleArtPageChange)} </> 
                 ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't added any art videos yet. </div> )} 
              </CardContent>
            </Card>
            <Card ref={generationsCardRef} className="mt-8 overflow-visible shadow-lg bg-gradient-to-br from-card to-gold-light/30 backdrop-blur-sm border border-gold-dark/20">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-amber-50 to-transparent rounded-t-md">
                <CardTitle className="text-[#2F4F2E]/75">Generations</CardTitle>
                {isOwner && !forceLoggedOutView && (
                  <Dialog open={isGenerationUploadModalOpen} onOpenChange={setIsGenerationUploadModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-gradient-to-r from-gold-dark to-gold hover:opacity-90 transition-all duration-300">
                        Add Generation
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-lg w-[90vw] max-w-[90vw] sm:max-w-[80vw] max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                      <DialogHeader>
                        <DialogTitle>Upload Generation</DialogTitle>
                      </DialogHeader>
                      <UploadPage 
                        initialMode="media" 
                        defaultClassification="gen" 
                        hideLayout={true} 
                        onSuccess={handleGenerationUploadSuccess}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                 {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                  generationVideos.length > 0 ? ( <> 
                    <div ref={generationsGridRef}> {/* Removed -mt-10 wrapper */}
                       <VideoGallerySection 
                         header="" // No header inside card
                         videos={generationItemsForPage}
                         itemsPerRow={6} // Match Index page
                         isLoading={isLoadingVideos}
                         isAdmin={canEdit}
                         isAuthorized={canEdit}
                         compact={true} // Use compact mode inside card
                         onOpenLightbox={handleOpenLightbox}
                         onApproveVideo={approveVideo}
                         onRejectVideo={rejectVideo}
                         onDeleteVideo={deleteVideo}
                         onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate}
                         alwaysShowInfo={true} // Always show on profile
                         showAddButton={false}
                         seeAllPath=""
                         emptyMessage="This user hasn't added any generations yet."
                       />
                     </div>
                     {totalGenerationPages > 1 && renderPaginationControls(generationPage, totalGenerationPages, handleGenerationPageChange)} </> 
                 ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't generated any videos yet. </div> )} 
              </CardContent>
            </Card>



          </>
        )}
      </main>

      {lightboxVideo && (
        <VideoLightbox isOpen={!!lightboxVideo} onClose={handleCloseLightbox} videoUrl={lightboxVideo.url} videoId={lightboxVideo.id}
          title={lightboxVideo.metadata?.title} description={lightboxVideo.metadata?.description}
          initialAssetId={lightboxVideo.associatedAssetId ?? undefined}
          creator={lightboxVideo.user_id}
          thumbnailUrl={lightboxVideo.placeholder_image || lightboxVideo.metadata?.placeholder_image}
          creatorId={lightboxVideo.user_id}
          onVideoUpdate={() => { if (profile?.id) fetchUserVideos(profile.id, user?.id, isAdmin && !forceLoggedOutView, false); }}
          isAuthorized={canEdit} currentStatus={lightboxVideo.user_status} onStatusChange={handleLightboxUserStatusChange}
          adminStatus={lightboxVideo.admin_status} onAdminStatusChange={handleLightboxAdminStatusChange}
          hasPrev={currentLightboxIndex > 0}
          hasNext={currentLightboxIndex !== -1 && currentLightboxIndex < fullVideoListForLightbox.length - 1}
          onPrevVideo={handlePrevLightboxVideo}
          onNextVideo={handleNextLightboxVideo}
        />
      )}

      <Footer />
    </div>
  );
}
