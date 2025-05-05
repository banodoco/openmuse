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
  // Use the correct VideoDisplayStatus order: Pinned > Listed > Hidden
  const statusOrder: { [key in VideoDisplayStatus]?: number } = {
    Pinned: 1,   // Pinned first
    Listed: 2,   // Listed second
    Hidden: 3,   // Hidden last
  };
  return [...videos].sort((a, b) => {
    // Sort based on user_status, default to 'Listed'
    const statusA = a.user_status || 'Listed';
    const statusB = b.user_status || 'Listed';
    // Default to Listed order (2) if status not found
    const orderA = statusOrder[statusA as VideoDisplayStatus] ?? 2;
    const orderB = statusOrder[statusB as VideoDisplayStatus] ?? 2;

    if (orderA !== orderB) return orderA - orderB;
    
    // Fallback to sorting by creation date (newest first)
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
};

const sortUserAssets = (assets: LoraAsset[]): LoraAsset[] => {
  // Order: Pinned > Listed > Hidden
  const statusOrder: { [key in UserAssetPreferenceStatus]: number } = { 
    'Pinned': 1, 
    'Listed': 2, 
    'Hidden': 3 // Note: Original code had Hidden as 4, corrected to 3 for sequential order
  };
  return [...assets].sort((a, b) => {
    const statusA = a.user_status;
    const statusB = b.user_status;
    // Default to Listed order (2)
    const orderA = statusA ? (statusOrder[statusA] ?? 2) : 2;
    const orderB = statusB ? (statusOrder[statusB] ?? 2) : 2;
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
  const { username } = useParams<{ username: string }>();
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

  // Insert missing hook definitions
  const fetchUserAssets = useCallback(async (profileUserId: string, canViewerSeeHiddenAssets: boolean, page: number) => {
    logger.log('[fetchUserAssets] Fetching page...', { profileUserId, canViewerSeeHiddenAssets, page });
    setIsLoadingAssets(true);
    const pageSize = 16; // Use a fixed page size
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;
    try {
      const { data: assetsData, error: assetsError, count } = await supabase
        .from('assets')
        .select(`*, primaryVideo:primary_media_id(*)`, { count: 'exact' })
        .eq('user_id', profileUserId)
        .order('created_at', { ascending: false })
        .range(rangeFrom, rangeTo);
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
  }, []);

  const fetchUserVideos = useCallback(async (
    userId: string,
    currentViewerId: string | null | undefined,
    isViewerAdmin: boolean,
    showLoading: boolean = true
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
  }, []);

  const handleOpenLightbox = useCallback((video: VideoEntry) => {
    setLightboxVideo(video);
    setInitialVideoParamHandled(true);
  }, [setLightboxVideo, setInitialVideoParamHandled]);

  // Only this flag (not the whole query string) should trigger data refetch
  const loggedOutViewParam = searchParams.get('loggedOutView');

  logger.log(`[UserProfilePage Render Start] isAuthLoading: ${isAuthLoading}, user ID: ${user?.id}`);

  // Add a memoized version of searchParams that excludes the "video" parameter
  const searchParamsWithoutVideo = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("video");
    return params.toString();
  }, [searchParams]);

  // --- Main Data Fetching Effect ---
  useEffect(() => {
    logger.log("Main data fetching effect triggered", { username, isAuthLoading, userId: user?.id, isAdmin, loggedOutViewParam });
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
      if (!username) {
        logger.warn("No username in URL parameters, cannot fetch profile.");
        setIsLoadingProfile(false);
        setProfile(null);
        setUserAssets([]);
        setUserVideos([]);
        return;
      }
      
      logger.log("Fetching profile for username:", username);
      setIsLoadingProfile(true);
      setIsLoadingAssets(true);
      setIsLoadingVideos(true);

      try {
        // Step 1: Fetch profile by username
        logger.log('[fetchProfileAndInitialData] Step 1: Fetching profile by username:', username);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (profileError) {
          logger.error('[fetchProfileAndInitialData] Step 1 Failed - Error fetching profile:', username, profileError);
          toast.error(`Error loading profile for ${username}.`);
          setIsLoadingProfile(false); setIsLoadingAssets(false); setIsLoadingVideos(false);
          return;
        }
        if (!profileData) {
          logger.warn('[fetchProfileAndInitialData] Step 1 Failed - Profile not found:', username);
          toast.error(`Profile not found for ${username}`);
          setIsLoadingProfile(false); setIsLoadingAssets(false); setIsLoadingVideos(false);
          setProfile(null); 
          return;
        }

        logger.log('[fetchProfileAndInitialData] Step 1 Success - Profile found:', profileData.id);
        const fetchedProfileUserId = profileData.id;

        // Determine ownership and edit permissions
        const currentUserId = user?.id;
        const isProfileOwner = !!currentUserId && currentUserId === fetchedProfileUserId;
        const canEditProfile = isProfileOwner || isAdmin;
        const viewerCanSeeHidden = canEditProfile || forcePublic === false;

        if (!unmountedRef.current) {
          setProfile(profileData);
          setIsOwner(isProfileOwner);
          setCanEdit(canEditProfile);
          setIsLoadingProfile(false);
        }

        // Step 2: Fetch assets associated with the profile ID
        logger.log('[fetchProfileAndInitialData] Step 2: Fetching assets for profile ID:', fetchedProfileUserId);
        const { data: assetsData, error: assetsError } = await supabase
          .from('assets')
          .select('*, primaryVideo:primary_media_id(*)')
          .eq('user_id', fetchedProfileUserId);
          
        let processedAssets = [];
        if (assetsError) {
            logger.error('[fetchProfileAndInitialData] Step 2 Failed - Error fetching assets:', assetsError);
            toast.error('Failed to load associated LoRAs.');
        } else {
            processedAssets = (assetsData || []).map((asset) => { 
              const pVideo = asset.primaryVideo;
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
                user_status: asset.user_status,
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
                    description: pVideo.description || '',
                    creator: pVideo.creator ? 'self' : undefined,
                    classification: pVideo.classification || 'gen',
                    placeholder_image: pVideo.placeholder_image || null,
                    assetId: asset.id,
                  }
                } : undefined
              };
            });
            logger.log('[fetchProfileAndInitialData] Step 2 Success - Assets raw data processed.');
        }
        
        const visibleAssets = viewerCanSeeHidden
            ? processedAssets
            : processedAssets.filter(asset => asset.user_status !== 'Hidden');
        const sortedPageAssets = sortUserAssets(visibleAssets);
        
        if (!unmountedRef.current) {
          setUserAssets(sortedPageAssets);
          setTotalAssets(visibleAssets.length);
          setIsLoadingAssets(false);
          logger.log('[fetchProfileAndInitialData] Step 2 State Updated - Assets filtered and sorted.');
        }

        // Step 3: Fetch media (videos) associated with the profile ID
        logger.log('[fetchProfileAndInitialData] Step 3: Fetching media for profile ID:', fetchedProfileUserId);
        const { data: videosData, error: videosError } = await supabase
          .from('media')
          .select('*, asset_media!left(asset_id)')
          .eq('user_id', fetchedProfileUserId)
          .eq('type', 'video'); 

        let allVideos = [];
        if (videosError) {
            logger.error('[fetchProfileAndInitialData] Step 3 Failed - Error fetching media:', videosError);
            toast.error('Failed to load associated videos.');
        } else {
            allVideos = (videosData || []).map((video) => { 
              let classification = video.classification || 'gen';
              if (classification !== 'art' && classification !== 'gen') {
                classification = 'gen';
              }
              const associatedAssetId = video.asset_media?.[0]?.asset_id || null; 
              return {
                id: video.id,
                url: video.url,
                associatedAssetId: associatedAssetId,
                reviewer_name: video.creator || '',
                skipped: false,
                created_at: video.created_at,
                admin_status: video.admin_status,
                user_status: video.user_status || null,
                assetMediaDisplayStatus: null,
                user_id: video.user_id,
                metadata: { 
                  title: video.title || '',
                  description: video.description || '',
                  creator: 'self',
                  classification: classification,
                  placeholder_image: video.placeholder_image,
                  assetId: associatedAssetId,
                  creatorName: video.creator,
                },
                thumbnailUrl: video.placeholder_image,
                title: video.title || '',
                description: video.description || '',
                is_primary: false,
                aspectRatio: (video.metadata)?.aspectRatio || 16/9,
                classification: classification,
              };
            }).filter(Boolean);
            logger.log('[fetchProfileAndInitialData] Step 3 Success - Media raw data processed.');
        }
        
        const visibleVideos = viewerCanSeeHidden
            ? allVideos
            : allVideos.filter(video => 
                video.user_status !== 'Hidden' && 
                (video.admin_status !== 'Hidden' && video.admin_status !== 'Rejected')
              );
        const generationVideos = visibleVideos.filter(v => v.metadata?.classification === 'gen');
        const artVideos = visibleVideos.filter(v => v.metadata?.classification === 'art');
        const sortedGenerationVideos = sortProfileVideos(generationVideos);
        const sortedArtVideos = sortProfileVideos(artVideos);

        if (!unmountedRef.current) {
          setUserVideos(sortedGenerationVideos.concat(sortedArtVideos)); 
          setTotalGenerationVideos(sortedGenerationVideos.length);
          setTotalArtVideos(sortedArtVideos.length);
          const videoIdParam = searchParams.get('video');
          if (videoIdParam && !initialVideoParamHandled) {
            const initialVideo = visibleVideos.find(v => v.id === videoIdParam);
            if (initialVideo) {
              setLightboxVideo(initialVideo);
              setInitialVideoParamHandled(true);
            }
          }
          setIsLoadingVideos(false);
          logger.log('[fetchProfileAndInitialData] Step 3 State Updated - Videos filtered and sorted.');
        }

        logger.log('[fetchProfileAndInitialData] All steps complete.');

      } catch (error) {
        logger.error('[fetchProfileAndInitialData] Unexpected error during multi-step fetch:', error);
        if (!unmountedRef.current) {
            toast.error('Failed to load profile data. Please try again later.');
            setIsLoadingProfile(false);
            setIsLoadingAssets(false);
            setIsLoadingVideos(false);
        }
      }
    };

    if (username) {
      fetchProfileAndInitialData();
    } else {
      logger.warn("No username in URL parameter, skipping fetch.");
      setIsLoadingProfile(false);
      setProfile(null);
    }

  // NOTE: Removed searchParamsWithoutVideo and initialVideoParamHandled dependencies
  // to prevent refetching when lightbox opens/closes via ?video param.
  }, [username, user?.id, isAdmin, isAuthLoading, loggedOutViewParam, navigate]);

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
      {isAuthLoading ? (
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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
                      <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
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
                       <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
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
                <CardContent ref={artGridRef} className="p-4 md:p-6 pt-6">
                   {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 4} /> ) : 
                    artVideos.length > 0 ? ( <> 
                      <div> 
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
                      <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
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
                <CardContent ref={generationsGridRef} className="p-4 md:p-6 pt-6">
                   {isLoadingVideos ? ( <LoraGallerySkeleton count={isMobile ? 2 : 6} /> ) : 
                    generationVideos.length > 0 ? ( <> 
                      <div> 
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
      )}

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
          classification={lightboxVideo.metadata?.classification}
          onDeleteVideo={deleteVideo}
        />
      )}

      <Footer />
    </div>
  );
}
