import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AnyAsset, UserProfile, VideoEntry, VideoDisplayStatus, UserAssetPreferenceStatus, AdminStatus, AssetType, LoraAsset, WorkflowAsset } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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
import AssetManager from '@/components/AssetManager';
import { useAssetManagement } from '@/hooks/useAssetManagement';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';
import { useMockRoleContext } from '@/contexts/MockRoleContext';

const logger = new Logger('UserProfilePage');
const ASSET_PROFILE_PERF_ID_PREFIX = '[AssetLoadSpeed_UserProfilePage]';
const MOCK_OWNER_MARKER_USER_ID = '---MOCK_ASSET_OWNER_USER---';

const PROFILE_ASSET_ITEMS_PER_PAGE = 6;

// Define constants for video sections (these were missing)
const ART_PAGE_SIZE = 8;
const GENERATION_PAGE_SIZE = 12;
const ART_ITEMS_PER_ROW = 4;
const GENERATION_ITEMS_PER_ROW = 6;

const defaultBreakpointColumnsObj = { default: 3, 1100: 2, 640: 1 };
const generationBreakpointColumnsObj = { default: 6, 1100: 4, 768: 3, 640: 2 };

const calculatePageSize = (totalItems: number): number => {
  if (totalItems <= 8) return totalItems;
  if (totalItems <= 11) return 8;
  if (totalItems <= 15) return 12;
  return 16;
};

const sortProfileVideos = (videos: VideoEntry[]): VideoEntry[] => {
  const statusOrder: { [key in VideoDisplayStatus]?: number } = { Pinned: 1, Listed: 2, Hidden: 3 };
  return [...videos].sort((a, b) => {
    const orderA = statusOrder[a.user_status || 'Listed'] ?? 2;
    const orderB = statusOrder[b.user_status || 'Listed'] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });
};

const sortUserAssetsGeneral = (assets: AnyAsset[]): AnyAsset[] => {
  const statusOrder: { [key in UserAssetPreferenceStatus]: number } = { 'Pinned': 1, 'Listed': 2, 'Hidden': 3 };
  return [...assets].sort((a, b) => {
    const orderA = a.user_status ? (statusOrder[a.user_status] ?? 2) : 2;
    const orderB = b.user_status ? (statusOrder[b.user_status] ?? 2) : 2;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

const getPaginatedItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
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
  const { username: usernameFromParams } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin: authIsAdminHook, isLoading: isAuthLoading } = useAuth();
  const { mockRole, mockOwnerId: mockOwnerIdentifierFromContext, isStaging } = useMockRoleContext();
  const isMobile = useIsMobile();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  
  const [loraPage, setLoraPage] = useState(1);
  const [workflowPage, setWorkflowPage] = useState(1);
  const workflowCardRef = useRef<HTMLDivElement>(null);
  const workflowsGridRef = useRef<HTMLDivElement>(null);

  const [forceLoggedOutView, setForceLoggedOutView] = useState(false);
  const [userVideos, setUserVideos] = useState<VideoEntry[]>([]);
  const [totalGenerationVideos, setTotalGenerationVideos] = useState(0);
  const [totalArtVideos, setTotalArtVideos] = useState(0);
  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  const [initialVideoParamHandled, setInitialVideoParamHandled] = useState(false);
  const [isUpdatingAssetStatus, setIsUpdatingAssetStatus] = useState<Record<string, boolean>>({});
  
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const generationsGridRef = useRef<HTMLDivElement>(null);
  const artGridRef = useRef<HTMLDivElement>(null);
  const lorasGridRef = useRef<HTMLDivElement>(null); 
  const loraCardRef = useRef<HTMLDivElement>(null);
  const artCardRef = useRef<HTMLDivElement>(null);
  const generationsCardRef = useRef<HTMLDivElement>(null);
  const unmountedRef = useRef(false);

  const [artPage, setArtPage] = useState(1);
  const [generationPage, setGenerationPage] = useState(1);

  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current); };
  }, []);

  const [isLoraUploadModalOpen, setIsLoraUploadModalOpen] = useState(false);
  const [isWorkflowUploadModalOpen, setIsWorkflowUploadModalOpen] = useState(false);
  const [isArtUploadModalOpen, setIsArtUploadModalOpen] = useState(false);
  const [isGenerationUploadModalOpen, setIsGenerationUploadModalOpen] = useState(false);
  
  const profileUserId = profile?.id;

  const { 
    assets: userLoras, 
    isLoading: isLoadingLoras, 
    totalCount: totalLorasCount,
    refetchAssets: refetchUserLoras, 
    setAssetAdminStatus: setLoraAdminStatus 
  } = useAssetManagement({
    assetType: 'lora',
    approvalFilter: 'all',
    page: loraPage,
    pageSize: PROFILE_ASSET_ITEMS_PER_PAGE,
    userId: profileUserId,
  });

  const { 
    assets: userWorkflows, 
    isLoading: isLoadingWorkflows, 
    totalCount: totalWorkflowsCount,
    refetchAssets: refetchUserWorkflows, 
    setAssetAdminStatus: setWorkflowAdminStatus 
  } = useAssetManagement({
    assetType: 'workflow',
    approvalFilter: 'all',
    page: workflowPage,
    pageSize: PROFILE_ASSET_ITEMS_PER_PAGE,
    userId: profileUserId,
  });

  const totalLorasOnProfile = userLoras?.length || 0;
  const totalWorkflowsOnProfile = userWorkflows?.length || 0;

  const fetchUserVideosData = useCallback(async (
    userId: string,
    currentViewerId: string | null | undefined,
    isViewerAdmin: boolean,
    showLoading: boolean = true
  ) => {
    if (!userId) return;
    logger.log('[fetchUserVideosData] Fetching videos...', { userId });
    if (showLoading) setIsLoadingVideos(true);
    let fetchedVideos: VideoEntry[] = [];
    let artCount = 0, genCount = 0;
    try {
      const { data: videosData, error: videosError } = await supabase
        .from('media').select('*, asset_media!left(asset_id)').eq('user_id', userId).eq('type', 'video');
      if (videosError) throw videosError;
      if (videosData) {
        const videoIds = videosData.map(v => v.id);
        const mediaIdToAssetId = new Map<string, string>();
        if (videoIds.length > 0) {
          const { data: assetLinks } = await supabase.from('asset_media').select('media_id, asset_id').in('media_id', videoIds);
          assetLinks?.forEach(link => { if (link.media_id && link.asset_id) mediaIdToAssetId.set(link.media_id, link.asset_id); });
        }
        const processedVideos: VideoEntry[] = videosData.map(video => {
          const classification = (video.classification === 'art' || video.classification === 'gen') ? video.classification : 'gen';
          const associatedAssetId = mediaIdToAssetId.get(video.id) || null;
          return {
            id: video.id, url: video.url, associatedAssetId,
            reviewer_name: video.creator || '', skipped: false, created_at: video.created_at,
            admin_status: video.admin_status as AdminStatus | null,
            user_status: video.user_status as VideoDisplayStatus || null,
            assetMediaDisplayStatus: null, user_id: video.user_id,
            metadata: { title: video.title || '', description: video.description || '', creator: 'self', classification, placeholder_image: video.placeholder_image, assetId: associatedAssetId, creatorName: video.creator, aspectRatio: (video.metadata as any)?.aspectRatio ?? 16/9 }, 
            thumbnailUrl: video.placeholder_image, title: video.title || '', description: video.description || '', is_primary: false,
          };
        }).filter(Boolean) as VideoEntry[];
        const isViewerOwner = currentViewerId === userId;
        const canViewerSeeHidden = isViewerOwner || isViewerAdmin;
        const visibleVideos = processedVideos.filter(v => canViewerSeeHidden || (v.user_status !== 'Hidden' && v.admin_status !== 'Hidden' && v.admin_status !== 'Rejected'));
        fetchedVideos = sortProfileVideos(visibleVideos);
        artCount = fetchedVideos.filter(v => v.metadata?.classification === 'art').length;
        genCount = fetchedVideos.filter(v => v.metadata?.classification === 'gen').length;
      }
    } catch (err: any) { logger.error('[fetchUserVideosData] Error:', err); toast.error("Failed to load videos.");
    } finally {
      setUserVideos(fetchedVideos);
      setTotalArtVideos(artCount);
      setTotalGenerationVideos(genCount);
      if (showLoading) setIsLoadingVideos(false);
    }
  }, []);

  const loggedOutViewParam = searchParams.get('loggedOutView');
  useEffect(() => {
    const LOG_TAG = '[UserProfileFetch]';
    if (isAuthLoading) { logger.log(`${LOG_TAG} Auth loading...`); return; }
    const forcePublic = loggedOutViewParam === 'true';
    setForceLoggedOutView(forcePublic);
    const fetchProfileData = async () => {
      if (!usernameFromParams) { setIsLoadingProfile(false); setProfile(null); return; }
      setIsLoadingProfile(true);
      try {
        const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('username', usernameFromParams).maybeSingle();
        if (profileError || !profileData) { throw profileError || new Error('Profile not found'); }
        if (!unmountedRef.current) {
          setProfile(profileData);
            const fetchedUserId = profileData.id;
            const actualIsOwner = user?.id === fetchedUserId;
            const isMockOwner = isStaging && mockRole === 'owner' && user?.id === MOCK_OWNER_MARKER_USER_ID && profileData.username === mockOwnerIdentifierFromContext;
            const finalIsOwner = actualIsOwner || isMockOwner;
          setIsOwner(finalIsOwner); 
            setCanEdit(finalIsOwner || (authIsAdminHook && !forcePublic));
            fetchUserVideosData(fetchedUserId, user?.id, authIsAdminHook && !forcePublic, true);
            if(fetchedUserId) {
                refetchUserLoras();
                refetchUserWorkflows();
            }
        }
      } catch (error) { logger.error(`${LOG_TAG} Error:`, error); toast.error('Failed to load profile.'); setProfile(null); 
      } finally { if (!unmountedRef.current) setIsLoadingProfile(false); }
    };
    fetchProfileData();
  }, [usernameFromParams, user?.id, authIsAdminHook, isAuthLoading, loggedOutViewParam, mockRole, mockOwnerIdentifierFromContext, isStaging, fetchUserVideosData, refetchUserLoras, refetchUserWorkflows]);

  const generationVideos = useMemo(() => userVideos.filter(v => v.metadata?.classification === 'gen'), [userVideos]);
  const artVideos = useMemo(() => userVideos.filter(v => v.metadata?.classification === 'art'), [userVideos]);
  
  const totalLoraPagesOnProfile = useMemo(() => getTotalPages(totalLorasCount, PROFILE_ASSET_ITEMS_PER_PAGE), [totalLorasCount]);
  const totalWorkflowPagesOnProfile = useMemo(() => getTotalPages(totalWorkflowsCount, PROFILE_ASSET_ITEMS_PER_PAGE), [totalWorkflowsCount]);

  const totalGenerationPages = useMemo(() => getTotalPages(totalGenerationVideos, GENERATION_PAGE_SIZE), [totalGenerationVideos, GENERATION_PAGE_SIZE]);
  const totalArtPages = useMemo(() => getTotalPages(totalArtVideos, ART_PAGE_SIZE), [totalArtVideos, ART_PAGE_SIZE]);
  
  const loraItemsForPage = useMemo(() => sortUserAssetsGeneral(userLoras || []), [userLoras]);
  const workflowItemsForPage = useMemo(() => sortUserAssetsGeneral(userWorkflows || []), [userWorkflows]);

  const generationItemsForPage = useMemo(() => getPaginatedItems(generationVideos, generationPage, GENERATION_PAGE_SIZE), [generationVideos, generationPage, GENERATION_PAGE_SIZE]);
  const artItemsForPage = useMemo(() => getPaginatedItems(artVideos, artPage, ART_PAGE_SIZE), [artVideos, artPage, ART_PAGE_SIZE]);

  const handleAssetStatusUpdate = useCallback(async (assetId: string, newStatus: UserAssetPreferenceStatus): Promise<void> => {
    if (!user || !profile || user.id !== profile.id) { toast.error("Unauthorized action."); return; }
    setIsUpdatingAssetStatus(prev => ({ ...prev, [assetId]: true }));
    try {
      const { error } = await supabase.from('assets').update({ user_status: newStatus }).eq('id', assetId).eq('user_id', user.id);
      if (error) throw error;
      toast.success(`Asset status updated to ${newStatus}`);
      refetchUserLoras(); refetchUserWorkflows();
    } catch (error) { toast.error(`Failed to update status.`);
    } finally { setIsUpdatingAssetStatus(prev => ({ ...prev, [assetId]: false })); }
  }, [user, profile, refetchUserLoras, refetchUserWorkflows]);

  const handleLocalVideoUserStatusUpdate = useCallback((videoId: string, newStatus: VideoDisplayStatus) => {
    setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === videoId ? { ...video, user_status: newStatus } : video)));
  }, []); 

  const handleLightboxUserStatusChange = useCallback(async (newStatus: VideoDisplayStatus): Promise<void> => {
    if (!lightboxVideo || !user || !profile || user.id !== profile.id) { toast.error("Action not allowed."); return; }
    const videoId = lightboxVideo.id;
    try {
      const { error } = await supabase.from('media').update({ user_status: newStatus }).eq('id', videoId).eq('user_id', user.id);
      if (error) throw error;
      toast.success(`Video status updated to ${newStatus}`);
      handleLocalVideoUserStatusUpdate(videoId, newStatus);
      setLightboxVideo(prev => prev ? { ...prev, user_status: newStatus } : null);
    } catch (error) { toast.error('Failed to update video status'); }
  }, [lightboxVideo, user, profile, handleLocalVideoUserStatusUpdate]); 

  const handleLightboxAdminStatusChange = useCallback(async (newStatus: AdminStatus): Promise<void> => {
    if (!lightboxVideo || !authIsAdminHook) { toast.error("Action not allowed."); return; }
    const videoId = lightboxVideo.id;
    try {
      const { error } = await supabase.from('media').update({ admin_status: newStatus, admin_reviewed: true }).eq('id', videoId);
      if (error) throw error;
      toast.success(`Video admin status updated to ${newStatus}`);
      setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === videoId ? { ...video, admin_status: newStatus } : video)));
      setLightboxVideo(prev => prev ? { ...prev, admin_status: newStatus } : null);
    } catch (error) { toast.error('Failed to update video admin status'); }
  }, [lightboxVideo, authIsAdminHook, setUserVideos]);

  const deleteVideo = useCallback(async (videoId: string): Promise<void> => {
    const canPerformDelete = (isOwner || authIsAdminHook) && !forceLoggedOutView;
    if (!canPerformDelete) { toast.error("Unauthorized action."); return; }
    try {
      await supabase.from('media').delete().eq('id', videoId);
      setUserVideos(prev => sortProfileVideos(prev.filter(video => video.id !== videoId)));
      toast.success('Video deleted successfully');
    } catch (error: any) { toast.error(`Failed to delete video: ${error.message || 'Unknown error'}`); }
  }, [authIsAdminHook, isOwner, forceLoggedOutView, setUserVideos]);

  const approveVideo = useCallback(async (id: string): Promise<void> => {
    if (!authIsAdminHook) return;
    try {
      await supabase.from('media').update({ admin_status: 'Curated', admin_reviewed: true }).eq('id', id);
      setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Curated' as AdminStatus } : video)));
      toast.success("Video Approved (Curated)");
    } catch (error) { toast.error("Failed to approve video.");  }
  }, [authIsAdminHook, setUserVideos]);

  const rejectVideo = useCallback(async (id: string): Promise<void> => {
    if (!authIsAdminHook) return;
    try {
      await supabase.from('media').update({ admin_status: 'Rejected', admin_reviewed: true }).eq('id', id);
      setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Rejected' as AdminStatus } : video)));
      toast.success("Video Rejected");
    } catch (error) { toast.error("Failed to reject video."); }
  }, [authIsAdminHook, setUserVideos]);

  const handleLoraUploadSuccess = useCallback(() => { setIsLoraUploadModalOpen(false); refetchUserLoras(); }, [refetchUserLoras]);
  const handleWorkflowUploadSuccess = useCallback(() => { setIsWorkflowUploadModalOpen(false); refetchUserWorkflows(); }, [refetchUserWorkflows]);
  const handleArtUploadSuccess = useCallback(() => { setIsArtUploadModalOpen(false); if(profile?.id) fetchUserVideosData(profile.id, user?.id, authIsAdminHook, false);}, [profile?.id, user?.id, authIsAdminHook, fetchUserVideosData]);
  const handleGenerationUploadSuccess = useCallback(() => { setIsGenerationUploadModalOpen(false); if(profile?.id) fetchUserVideosData(profile.id, user?.id, authIsAdminHook, false);}, [profile?.id, user?.id, authIsAdminHook, fetchUserVideosData]);

  const handleOpenLightbox = useCallback((video: VideoEntry) => { setLightboxVideo(video); setInitialVideoParamHandled(true); }, [setLightboxVideo, setInitialVideoParamHandled]);
  const fullVideoListForLightbox = useMemo(() => {
    const gen = Array.isArray(generationItemsForPage) ? generationItemsForPage : [];
    const art = Array.isArray(artItemsForPage) ? artItemsForPage : [];
    return [...gen, ...art];
  }, [generationItemsForPage, artItemsForPage]);
  const currentLightboxIndex = useMemo(() => {
    if (!lightboxVideo) return -1;
    return fullVideoListForLightbox.findIndex(v => v.id === lightboxVideo.id);
  }, [lightboxVideo, fullVideoListForLightbox]);
  const handlePrevLightboxVideo = useCallback(() => {
    if (currentLightboxIndex > 0) setLightboxVideo(fullVideoListForLightbox[currentLightboxIndex - 1]);
  }, [currentLightboxIndex, fullVideoListForLightbox, setLightboxVideo]);
  const handleNextLightboxVideo = useCallback(() => {
    if (currentLightboxIndex !== -1 && currentLightboxIndex < fullVideoListForLightbox.length - 1) {
      setLightboxVideo(fullVideoListForLightbox[currentLightboxIndex + 1]);
    }
  }, [currentLightboxIndex, fullVideoListForLightbox, setLightboxVideo]);

  useEffect(() => {
    const videoParam = searchParams.get('video');
    if (videoParam && !initialVideoParamHandled && userVideos.length > 0) {
      const initialVideo = userVideos.find(v => v.id === videoParam);
      if (initialVideo) handleOpenLightbox(initialVideo);
    }
  }, [searchParams, userVideos, initialVideoParamHandled, lightboxVideo, handleOpenLightbox]);

  useFadeInOnScroll(loraCardRef);
  useFadeInOnScroll(artCardRef);
  useFadeInOnScroll(generationsCardRef);
  useFadeInOnScroll(workflowCardRef);

  const getInitials = (name?: string) => name?.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2) || '??';
  
  const handleArtPageChange = (newPage: number) => { scrollToElementWithOffset(artGridRef.current); setTimeout(() => { if (!unmountedRef.current) setArtPage(newPage); }, 300); };
  const handleGenerationPageChange = (newPage: number) => { scrollToElementWithOffset(generationsGridRef.current); setTimeout(() => { if (!unmountedRef.current) setGenerationPage(newPage); }, 300); };
  const handleLoraPageChange = (newPage: number) => { scrollToElementWithOffset(lorasGridRef.current); setTimeout(() => { if (!unmountedRef.current) setLoraPage(newPage); }, 300); };
  const handleWorkflowPageChange = (newPage: number) => { scrollToElementWithOffset(workflowsGridRef.current); setTimeout(() => { if(!unmountedRef.current) setWorkflowPage(newPage); }, 300); };
  const handleCloseLightbox = () => setLightboxVideo(null);

  const renderPaginationControls = (
    currentPage: number, totalPages: number, onPageChange: (page: number) => void, keyPrefix: string
  ) => {
    if (totalPages <= 1) return null; 
    const handlePrevious = () => { if (currentPage > 1) onPageChange(currentPage - 1); };
    const handleNext = () => { if (currentPage < totalPages) onPageChange(currentPage + 1); };
    const paginationItems = []; const maxPagesToShow = 5;
    const ellipsis = <PaginationEllipsis key={`${keyPrefix}-ellipsis`} />;
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) paginationItems.push(<PaginationItem key={`${keyPrefix}-${i}`}><PaginationLink href="#" isActive={currentPage === i} onClick={(e)=>{e.preventDefault();onPageChange(i);}}>{i}</PaginationLink></PaginationItem>);
    } else {
      paginationItems.push(<PaginationItem key={`${keyPrefix}-1`}><PaginationLink href="#" isActive={currentPage === 1} onClick={(e)=>{e.preventDefault();onPageChange(1);}}>1</PaginationLink></PaginationItem>);
      if (currentPage > 3) paginationItems.push(React.cloneElement(ellipsis, {key:`${keyPrefix}-start-ellipsis`}));
      let startP = Math.max(2,currentPage-1); let endP = Math.min(totalPages-1,currentPage+1);
      if(currentPage<=3)endP=Math.min(totalPages-1,maxPagesToShow-2);
      if(currentPage>=totalPages-2)startP=Math.max(2,totalPages-maxPagesToShow+2);
      for(let i=startP;i<=endP;i++)paginationItems.push(<PaginationItem key={`${keyPrefix}-${i}`} className={cn(currentPage===i?"":"hidden md:list-item")}><PaginationLink href="#" isActive={currentPage===i} onClick={(e)=>{e.preventDefault();onPageChange(i);}}>{i}</PaginationLink></PaginationItem>);
      if(currentPage<totalPages-2)paginationItems.push(React.cloneElement(ellipsis,{key:`${keyPrefix}-end-ellipsis`}));
      paginationItems.push(<PaginationItem key={`${keyPrefix}-${totalPages}`}><PaginationLink href="#" isActive={currentPage===totalPages} onClick={(e)=>{e.preventDefault();onPageChange(totalPages);}}>{totalPages}</PaginationLink></PaginationItem>);
    }
    return ( 
      <Pagination className="mt-6"><PaginationContent>
        <PaginationItem><PaginationPrevious href="#" onClick={(e)=>{e.preventDefault();handlePrevious();}} aria-disabled={currentPage===1} className={cn(currentPage===1 && 'pointer-events-none opacity-50')}/></PaginationItem>
        {paginationItems}
        <PaginationItem><PaginationNext href="#" onClick={(e)=>{e.preventDefault();handleNext();}} aria-disabled={currentPage===totalPages} className={cn(currentPage===totalPages && 'pointer-events-none opacity-50')}/></PaginationItem>
      </PaginationContent></Pagination>
    );
  };

  const featuredCount = useMemo(() => {
    const videoFeatured = userVideos.filter(v => v.admin_status === 'Curated' || v.admin_status === 'Featured').length;
    const loraFeatured = (userLoras || []).filter(a => a.admin_status === 'Curated' || a.admin_status === 'Featured').length;
    const workflowFeatured = (userWorkflows || []).filter(a => a.admin_status === 'Curated' || a.admin_status === 'Featured').length;
    return videoFeatured + loraFeatured + workflowFeatured;
  }, [userVideos, userLoras, userWorkflows]);

  return (
    <div className="w-full min-h-screen flex flex-col text-foreground">
       <Helmet>
         <title>{profile ? `${profile.display_name || profile.username}'s Profile` : 'User Profile'} | OpenMuse</title>
         {/* ... other meta tags ... */}
      </Helmet>

      <Navigation />
      {isAuthLoading ? (
        <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
          <PageHeader title="" description="" />

          {isLoadingProfile ? (
            <div className="flex justify-center items-center py-16"> <Loader2 className="h-16 w-16 animate-spin text-primary" /> </div>
          ) : !profile || !profile.id || !profile.username ? (
            <div className="text-center py-16 text-muted-foreground"> Profile not found or failed to load. </div>
          ) : (
            <>
              <div className="max-w-2xl mx-auto">
                {(isOwner && !forceLoggedOutView) ? (
                  <UserProfileSettings profileDataForEdit={ (isStaging && mockRole === 'owner') ? profile : null } />
                ) : ( 
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
                                <HoverCardTrigger asChild><img src="/reward.png" alt="Featured" className="h-6 w-6 rounded-full" /></HoverCardTrigger>
                                <HoverCardContent className="p-2 text-sm w-fit min-w-0" side="top" align="start" sideOffset={5}>{`Featured ${featuredCount} ${featuredCount === 1 ? 'time' : 'times'}`}</HoverCardContent>
                              </HoverCard> )}
                          </div>
                          {profile.real_name && <p className="text-muted-foreground mt-1">{profile.real_name}</p>} 
                          <p className="text-muted-foreground text-sm">{!isOwner && <span className="mr-0.5">@</span>}{profile.username}</p>
                          {profile.description && <div className="mt-4 max-w-md mx-auto"> <p className="text-sm text-foreground/90 bg-muted/20 p-3 rounded-lg">{profile.description}</p> </div>} 
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
                      <DialogTrigger asChild><Button className="bg-gradient-to-r from-forest to-olive hover:from-forest-dark hover:to-olive-dark transition-all duration-300" size="sm">Add LoRA</Button></DialogTrigger>
                      <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                        <DialogHeader><DialogTitle>Add LoRA</DialogTitle></DialogHeader>
                        <UploadPage initialMode="lora" defaultClassification="gen" hideLayout={true} onSuccess={handleLoraUploadSuccess}/>
                      </DialogContent>
                    </Dialog>)}
                </CardHeader>
                <CardContent ref={lorasGridRef} className="p-4 md:p-6 pt-6">
                  {isLoadingLoras && !profileUserId ? <p className="text-muted-foreground text-center">Loading profile...</p> : isLoadingLoras ? ( <LoraGallerySkeleton count={PROFILE_ASSET_ITEMS_PER_PAGE} /> ) : 
                   loraItemsForPage.length > 0 ? ( <> 
                      <AssetManager
                        assets={loraItemsForPage} 
                        isLoading={isLoadingLoras}
                        isAdmin={canEdit}
                        onUserStatusChange={handleAssetStatusUpdate}
                        isUpdatingStatusMap={isUpdatingAssetStatus}
                        showHeader={false}
                        hideCreatorInfo={true}
                        title="LoRAs"
                        itemsPerRow={3}
                      />
                      {totalLoraPagesOnProfile > 1 && renderPaginationControls(loraPage, totalLoraPagesOnProfile, handleLoraPageChange, 'profile-lora')} </> 
                  ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't created any LoRAs yet. </div> )} 
                </CardContent>
              </Card>

              <Card ref={workflowCardRef} className="mt-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-sky-light/70 backdrop-blur-sm border border-sky-dark/20">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-blue-50 to-transparent rounded-t-md">
                  <CardTitle className="text-[#2F4F2E]/75">Workflows</CardTitle>
                  {isOwner && !forceLoggedOutView && (
                    <Dialog open={isWorkflowUploadModalOpen} onOpenChange={setIsWorkflowUploadModalOpen}>
                      <DialogTrigger asChild><Button className="bg-gradient-to-r from-sky-dark to-sky hover:opacity-90 transition-all duration-300" size="sm">Add Workflow</Button></DialogTrigger>
                      <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                        <DialogHeader><DialogTitle>Add Workflow</DialogTitle></DialogHeader>
                        <UploadPage initialMode="workflow" hideLayout={true} onSuccess={handleWorkflowUploadSuccess} />
                      </DialogContent>
                    </Dialog>)}
                </CardHeader>
                <CardContent ref={workflowsGridRef} className="p-4 md:p-6 pt-6">
                  {isLoadingWorkflows && !profileUserId ? <p className="text-muted-foreground text-center">Loading profile...</p> : isLoadingWorkflows ? ( <LoraGallerySkeleton count={PROFILE_ASSET_ITEMS_PER_PAGE} /> ) : 
                   workflowItemsForPage.length > 0 ? ( <> 
                      <AssetManager
                        assets={workflowItemsForPage} 
                        isLoading={isLoadingWorkflows}
                        isAdmin={canEdit} 
                        onUserStatusChange={handleAssetStatusUpdate}
                        isUpdatingStatusMap={isUpdatingAssetStatus}
                        showHeader={false} 
                        hideCreatorInfo={true}
                        title="Workflows"
                        itemsPerRow={3}
                      />
                      {totalWorkflowPagesOnProfile > 1 && renderPaginationControls(workflowPage, totalWorkflowPagesOnProfile, handleWorkflowPageChange, 'profile-workflow')} </> 
                  ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't created any workflows yet. </div> )} 
                </CardContent>
              </Card>

              <Card ref={artCardRef} className="mt-8 mb-8 overflow-visible shadow-lg bg-gradient-to-br from-card to-olive-light/30 backdrop-blur-sm border border-olive-dark/20">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-amber-50 to-transparent rounded-t-md">
                  <CardTitle className="text-[#2F4F2E]/75">Art</CardTitle>
                  {isOwner && !forceLoggedOutView && (
                     <Dialog open={isArtUploadModalOpen} onOpenChange={setIsArtUploadModalOpen}>
                       <DialogTrigger asChild><Button size="sm" className="bg-gradient-to-r from-olive-dark to-olive hover:opacity-90 transition-all duration-300">Add Art</Button></DialogTrigger>
                       <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                         <DialogHeader><DialogTitle>Upload Art</DialogTitle></DialogHeader>
                         <UploadPage initialMode="media" defaultClassification="art" hideLayout={true} onSuccess={handleArtUploadSuccess} />
                       </DialogContent>
                     </Dialog> )}
                </CardHeader>
                <CardContent ref={artGridRef} className="p-4 md:p-6 pt-6">
                   {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : ART_ITEMS_PER_ROW} /> ) : 
                    artVideos.length > 0 ? ( <> 
                        <VideoGallerySection header="" videos={artItemsForPage} itemsPerRow={ART_ITEMS_PER_ROW} isLoading={isLoadingVideos} isAdmin={canEdit} isAuthorized={canEdit} compact={true} onOpenLightbox={handleOpenLightbox} onApproveVideo={approveVideo} onRejectVideo={rejectVideo} onDeleteVideo={deleteVideo} onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate} alwaysShowInfo={true} showAddButton={false} seeAllPath="" emptyMessage="This user hasn't added any art yet."/>
                      {totalArtPages > 1 && renderPaginationControls(artPage, totalArtPages, handleArtPageChange, 'profile-art')} </> 
                   ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't added any art videos yet. </div> )} 
                </CardContent>
              </Card>
              
              <Card ref={generationsCardRef} className="mt-8 overflow-visible shadow-lg bg-gradient-to-br from-card to-gold-light/30 backdrop-blur-sm border border-gold-dark/20">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-amber-50 to-transparent rounded-t-md">
                  <CardTitle className="text-[#2F4F2E]/75">Generations</CardTitle>
                  {isOwner && !forceLoggedOutView && (
                    <Dialog open={isGenerationUploadModalOpen} onOpenChange={setIsGenerationUploadModalOpen}>
                      <DialogTrigger asChild><Button size="sm" className="bg-gradient-to-r from-gold-dark to-gold hover:opacity-90 transition-all duration-300">Add Generation</Button></DialogTrigger>
                      <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                        <DialogHeader><DialogTitle>Upload Generation</DialogTitle></DialogHeader>
                        <UploadPage initialMode="media" defaultClassification="gen" hideLayout={true} onSuccess={handleGenerationUploadSuccess}/>
                      </DialogContent>
                    </Dialog>)}
                </CardHeader>
                <CardContent ref={generationsGridRef} className="p-4 md:p-6 pt-6">
                   {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : GENERATION_ITEMS_PER_ROW} /> ) : 
                    generationVideos.length > 0 ? ( <> 
                        <VideoGallerySection header="" videos={generationItemsForPage} itemsPerRow={GENERATION_ITEMS_PER_ROW} isLoading={isLoadingVideos} isAdmin={canEdit} isAuthorized={canEdit} compact={true} onOpenLightbox={handleOpenLightbox} onApproveVideo={approveVideo} onRejectVideo={rejectVideo} onDeleteVideo={deleteVideo} onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate} alwaysShowInfo={true} showAddButton={false} seeAllPath="" emptyMessage="This user hasn't generated any videos yet."/>
                       {totalGenerationPages > 1 && renderPaginationControls(generationPage, totalGenerationPages, handleGenerationPageChange, 'profile-gen')} </> 
                   ) : ( <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg"> This user hasn't generated any videos yet. </div> )} 
                </CardContent>
              </Card>
            </>
          )}
        </main>
      )}

      {lightboxVideo && (
        <VideoLightbox 
          isOpen={!!lightboxVideo} 
          onClose={handleCloseLightbox} 
          video={lightboxVideo}
          initialAssetId={lightboxVideo.associatedAssetId ?? undefined}
          onVideoUpdate={() => { if (profile?.id) fetchUserVideosData(profile.id, user?.id, authIsAdminHook && !forceLoggedOutView, false); }}
          isAuthorized={canEdit} 
          onStatusChange={handleLightboxUserStatusChange}
          onAdminStatusChange={handleLightboxAdminStatusChange}
          hasPrev={currentLightboxIndex > 0}
          hasNext={currentLightboxIndex !== -1 && currentLightboxIndex < fullVideoListForLightbox.length - 1}
          onPrevVideo={handlePrevLightboxVideo}
          onNextVideo={handleNextLightboxVideo}
          onDeleteVideo={deleteVideo}
        />
      )}
      <Footer />
    </div>
  );
}
