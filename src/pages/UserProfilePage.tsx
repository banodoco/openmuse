import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import UploadModal from '@/components/upload/UploadModal';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import VideoCard from '@/components/video/VideoCard';
import VideoLightbox from '@/components/VideoLightbox';
import Masonry from 'react-masonry-css';
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

const logger = new Logger('UserProfilePage');

// Helper functions (Keep these outside the component)
const calculatePageSize = (totalItems: number): number => {
  if (totalItems <= 8) return totalItems;
  if (totalItems <= 11) return 8;
  if (totalItems <= 15) return 12;
  return 16;
};

const sortProfileVideos = (videos: VideoEntry[]): VideoEntry[] => {
  const statusOrder: { [key in VideoDisplayStatus]: number } = { 'Pinned': 1, 'View': 2, 'Hidden': 3 };
  return [...videos].sort((a, b) => {
    const statusA = a.user_status || 'View';
    const statusB = b.user_status || 'View';
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
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [isUpdatingAssetStatus, setIsUpdatingAssetStatus] = useState<Record<string, boolean>>({});

  // Pagination State
  const [generationPage, setGenerationPage] = useState(1);
  const [artPage, setArtPage] = useState(1);
  const [loraPage, setLoraPage] = useState(1);

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

  const fetchUserVideos = useCallback(async (userId: string, currentViewerId: string | null | undefined, isViewerAdmin: boolean) => {
    logger.log('[fetchUserVideos] Fetching videos...', { userId, currentViewerId, isViewerAdmin });
    setIsLoadingVideos(true); 
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
            let classification = video.classification || 'generation';
            if (classification !== 'art' && classification !== 'generation') {
              classification = 'generation';
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
                classification: classification as 'art' | 'generation',
                placeholder_image: video.placeholder_image,
                assetId: associatedAssetId,
              },
              thumbnailUrl: video.placeholder_image,
              title: video.title || '',
              description: video.description || '',
              is_primary: false,
            };
          }).filter(Boolean) as VideoEntry[];

          const isViewerOwner = currentViewerId === userId;
          const canViewerSeeHidden = isViewerOwner || isViewerAdmin;
          const visibleVideos = processedVideos.filter(video =>
            canViewerSeeHidden || video.user_status !== 'Hidden'
          );
          fetchedVideos = sortProfileVideos(visibleVideos);
          generationCount = fetchedVideos.filter(v => v.metadata?.classification === 'generation').length;
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
        setIsLoadingVideos(false); 
    }
  }, []); // Dependencies likely needed: supabase

  // --- Main Data Fetching Effect --- 
  useEffect(() => {
    const shouldForceLoggedOutView = searchParams.get('loggedOutView') === 'true';
    setForceLoggedOutView(shouldForceLoggedOutView);
    let isMounted = true;
    const fetchProfileAndInitialData = async () => {
      if (!displayName) return;
      if (isMounted) {
        setIsLoadingProfile(true);
        setIsLoadingAssets(true); 
        setIsLoadingVideos(true);
        setProfile(null); 
        setUserAssets([]); setTotalAssets(0);
        setUserVideos([]); setTotalGenerationVideos(0); setTotalArtVideos(0);
        setIsOwner(false);
        setCanEdit(false);
        setGenerationPage(1);
        setArtPage(1);
        setLoraPage(1);
      }
      try {
        const decodedDisplayName = decodeURIComponent(displayName);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .or(`display_name.eq.${decodedDisplayName},username.eq.${decodedDisplayName}`)
          .maybeSingle();
        if (!isMounted) return;
        if (profileError || !profileData) {
            logger.error('Error fetching profile or profile not found:', profileError);
            if (isMounted) {
                toast.error(profileError?.message || "Profile not found.");
                setIsLoadingProfile(false);
                setIsLoadingAssets(false);
                setIsLoadingVideos(false);
                navigate('/');
            }
            return;
        }
        const currentProfile = profileData as UserProfile;
        const ownerStatus = !shouldForceLoggedOutView && user?.id === currentProfile.id;
        const currentIsAdmin = !!isAdmin && !shouldForceLoggedOutView; 
        const editPermissions = ownerStatus || currentIsAdmin;
        if (isMounted) { 
            setProfile(currentProfile);
            setIsOwner(ownerStatus);
            setCanEdit(editPermissions);
            setIsLoadingProfile(false);
        } else {
            return;
        }
        if (currentProfile.id) {
          const canSeeHidden = editPermissions;
          await Promise.allSettled([
            fetchUserAssets(currentProfile.id, canSeeHidden, 1),
            fetchUserVideos(currentProfile.id, user?.id, currentIsAdmin)
          ]);
        } else {
            logger.warn("Profile fetched but has no ID, skipping asset/video fetch.", currentProfile);
             if (isMounted) { 
                setIsLoadingAssets(false);
                setIsLoadingVideos(false);
            }
        }
      } catch (err) {
        logger.error('Unexpected error in fetchProfileAndData process:', err);
        if (isMounted) {
          toast.error("An unexpected error occurred loading profile data.");
          setIsLoadingProfile(false);
          setIsLoadingAssets(false);
          setIsLoadingVideos(false);
        }
      }
    };
    fetchProfileAndInitialData();
    return () => { isMounted = false }; 
  }, [displayName, user, navigate, isAdmin, searchParams, fetchUserAssets, fetchUserVideos]);

  // --- Derived State with useMemo --- 
  const generationVideos = useMemo(() => userVideos.filter(v => v.metadata?.classification === 'generation'), [userVideos]);
  const artVideos = useMemo(() => userVideos.filter(v => v.metadata?.classification === 'art'), [userVideos]);
  const loraPageSize = useMemo(() => calculatePageSize(userAssets.length), [userAssets.length]);
  const generationPageSize = useMemo(() => calculatePageSize(generationVideos.length), [generationVideos.length]);
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
  const handleGenerationPageChange = (newPage: number) => setGenerationPage(newPage);
  const handleArtPageChange = (newPage: number) => setArtPage(newPage);
  const handleLoraPageChange = (newPage: number) => setLoraPage(newPage);
  const handleOpenLightbox = (video: VideoEntry) => setLightboxVideo(video);
  const handleCloseLightbox = () => setLightboxVideo(null);
  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    setHoveredVideoId(isHovering ? videoId : (hoveredVideoId === videoId ? null : hoveredVideoId)); 
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

 const renderPaginationControls = ( currentPage: number, totalPages: number, onPageChange: (page: number) => void ) => {
    if (totalPages <= 1) return null; 
    return ( 
      <Pagination className="mt-6"> <PaginationContent> 
          <PaginationItem> <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); }} aria-disabled={currentPage === 1} className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined} /> </PaginationItem> 
          {[...Array(totalPages)].map((_, i) => { const page = i + 1; 
            if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) { return ( <PaginationItem key={page}> <PaginationLink href="#" onClick={(e) => { e.preventDefault(); onPageChange(page); }} isActive={page === currentPage}> {page} </PaginationLink> </PaginationItem> ); } 
            else if (Math.abs(page - currentPage) === 2) { return <PaginationEllipsis key={`ellipsis-${page}`} />; } 
            return null; 
          })} 
          <PaginationItem> <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) onPageChange(currentPage + 1); }} aria-disabled={currentPage === totalPages} className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined} /> </PaginationItem> 
      </PaginationContent> </Pagination> ); 
  };

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
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-forest-dark to-olive-dark bg-clip-text text-transparent"> {profile.display_name} </h2> 
                        {profile.real_name && <p className="text-muted-foreground mt-1">{profile.real_name}</p>} 
                        <p className="text-muted-foreground text-sm">{profile.username}</p> 
                        {profile.description && <div className="mt-4 max-w-md mx-auto"> <p className="text-sm text-foreground/90 bg-muted/20 p-3 rounded-lg">{profile.description}</p> </div>} 
                        {renderProfileLinks()} 
                      </div> 
                    </div> 
                  </CardContent> 
                </Card> 
              )} 
            </div>

            <Card className="mt-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-cream-light/70 backdrop-blur-sm border border-cream-dark/20 animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-forest/10 to-olive/10">
                <CardTitle className="text-forest-dark">LoRAs</CardTitle>
                {isOwner && !forceLoggedOutView && (
                  <UploadModal 
                    trigger={<Button className="bg-gradient-to-r from-forest to-olive hover:from-forest-dark hover:to-olive-dark transition-all duration-300"> Add new LoRA </Button>} 
                    initialUploadType="lora"
                    onUploadSuccess={() => { if(profile?.id) fetchUserAssets(profile.id, canEdit, 1); }} /> 
                )}
              </CardHeader>
              <CardContent>
                {isLoadingAssets ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                 userAssets.length > 0 ? ( <> 
                    <div className="relative pt-6"> <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid" columnClassName="my-masonry-grid_column"> 
                        {loraItemsForPage.map(item => ( <LoraCard key={item.id} lora={item} isAdmin={isAdmin && !forceLoggedOutView} isOwnProfile={isOwner} userStatus={item.user_status} onUserStatusChange={handleAssetStatusUpdate} hideCreatorInfo={true} isUpdatingStatus={isUpdatingAssetStatus[item.id]} /> ))} 
                    </Masonry> </div> 
                    {totalLoraPages > 1 && renderPaginationControls(loraPage, totalLoraPages, handleLoraPageChange)} </> 
                ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't created any LoRAs yet. </div> )} 
              </CardContent>
            </Card>

            <Card className="mt-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-gold-light/30 backdrop-blur-sm border border-gold-dark/20 animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-gold/10 to-cream/10">
                <CardTitle className="text-gold-dark">Generations</CardTitle>
                {isOwner && !forceLoggedOutView && (
                  <UploadModal 
                    trigger={<Button className="bg-gradient-to-r from-gold-dark to-gold hover:opacity-90 transition-all duration-300"> Add new Generation </Button>} 
                    initialUploadType="video" 
                    onUploadSuccess={() => { if(profile?.id) fetchUserVideos(profile.id, user?.id, isAdmin && !forceLoggedOutView); }} /> 
                )}
              </CardHeader>
              <CardContent>
                 {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                  generationVideos.length > 0 ? ( <> 
                     <div className="relative pt-6"> <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid" columnClassName="my-masonry-grid_column"> 
                         {generationItemsForPage.map((item) => ( <VideoCard key={item.id} video={item} isAdmin={canEdit} isAuthorized={canEdit} onOpenLightbox={handleOpenLightbox} onApproveVideo={approveVideo} onRejectVideo={rejectVideo} onDeleteVideo={deleteVideo} isHovering={hoveredVideoId === item.id} onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)} onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate} /> ))} 
                     </Masonry> </div> 
                     {totalGenerationPages > 1 && renderPaginationControls(generationPage, totalGenerationPages, handleGenerationPageChange)} </> 
                 ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't generated any videos yet. </div> )} 
              </CardContent>
            </Card>

            <Card className="mt-8 mb-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-olive-light/30 backdrop-blur-sm border border-olive-dark/20 animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-olive/10 to-cream/10">
                <CardTitle className="text-olive-dark">Art</CardTitle>
                {isOwner && !forceLoggedOutView && (
                   <UploadModal 
                     trigger={<Button className="bg-gradient-to-r from-olive-dark to-olive hover:opacity-90 transition-all duration-300"> Add new Art </Button>} 
                     initialUploadType="video" 
                     onUploadSuccess={() => { if(profile?.id) fetchUserVideos(profile.id, user?.id, isAdmin && !forceLoggedOutView); }}/> 
                )}
              </CardHeader>
              <CardContent>
                 {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 4} /> ) : 
                  artVideos.length > 0 ? ( <> 
                     <div className="relative pt-6"> <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid" columnClassName="my-masonry-grid_column"> 
                         {artItemsForPage.map((item) => ( <VideoCard key={item.id} video={item} isAdmin={canEdit} isAuthorized={canEdit} onOpenLightbox={handleOpenLightbox} onApproveVideo={approveVideo} onRejectVideo={rejectVideo} onDeleteVideo={deleteVideo} isHovering={hoveredVideoId === item.id} onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)} onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate} /> ))} 
                     </Masonry> </div> 
                     {totalArtPages > 1 && renderPaginationControls(artPage, totalArtPages, handleArtPageChange)} </> 
                 ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't added any art videos yet. </div> )} 
              </CardContent>
            </Card>

          </>
        )}
      </main>

      {lightboxVideo && (
        <VideoLightbox isOpen={!!lightboxVideo} onClose={handleCloseLightbox} videoUrl={lightboxVideo.url} videoId={lightboxVideo.id}
          title={lightboxVideo.metadata?.title} description={lightboxVideo.metadata?.description}
          initialAssetId={lightboxVideo.associatedAssetId ?? undefined}
          creator={lightboxVideo.user_id || lightboxVideo.metadata?.creatorName}
          thumbnailUrl={lightboxVideo.placeholder_image || lightboxVideo.metadata?.placeholder_image}
          creatorId={lightboxVideo.user_id}
          onVideoUpdate={() => { if (profile?.id) fetchUserVideos(profile.id, user?.id, isAdmin && !forceLoggedOutView); }}
          isAuthorized={canEdit} currentStatus={lightboxVideo.user_status} onStatusChange={handleLightboxUserStatusChange}
          adminStatus={lightboxVideo.admin_status} onAdminStatusChange={handleLightboxAdminStatusChange} />
      )}

      <Footer />
    </div>
  );
}
