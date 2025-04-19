import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, UserProfile, VideoEntry, VideoDisplayStatus } from '@/lib/types';
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

const logger = new Logger('UserProfilePage');

// Helper function to calculate page size based on total items
const calculatePageSize = (totalItems: number): number => {
  if (totalItems <= 8) return totalItems; // Rule 1: Show all if 8 or less
  if (totalItems <= 11) return 8;  // Rule 2: Use 8/page for 9-11 items
  if (totalItems <= 15) return 12; // Rule 3: Use 12/page for 12-15 items
  return 16;                        // Rule 4: Use 16/page for 16+ items
};

// Helper function to sort videos for the profile page based on user_status
const sortProfileVideos = (videos: VideoEntry[]): VideoEntry[] => {
  const statusOrder: { [key in VideoDisplayStatus]: number } = { 'Pinned': 1, 'View': 2, 'Hidden': 3 };
  return [...videos].sort((a, b) => {
    // Use user_status for profile page sorting
    const statusA = a.user_status || 'View';
    const statusB = b.user_status || 'View';
    const orderA = statusOrder[statusA] || 2;
    const orderB = statusOrder[statusB] || 2;

    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // Fallback to creation date
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

export default function UserProfilePage() {
  const { displayName } = useParams<{ displayName: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [userAssets, setUserAssets] = useState<LoraAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [forceLoggedOutView, setForceLoggedOutView] = useState(false);
  const [userVideos, setUserVideos] = useState<VideoEntry[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  const [generationVideos, setGenerationVideos] = useState<VideoEntry[]>([]);
  const [artVideos, setArtVideos] = useState<VideoEntry[]>([]);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);

  // Pagination State
  const [generationPage, setGenerationPage] = useState(1);
  const [artPage, setArtPage] = useState(1);
  const [loraPage, setLoraPage] = useState(1);

  useEffect(() => {
    setForceLoggedOutView(searchParams.get('loggedOutView') === 'true');
  }, [searchParams]);

  useEffect(() => {
    const fetchProfileByDisplayName = async () => {
      if (!displayName) return;
      
      setIsLoading(true);
      
      try {
        const decodedDisplayName = decodeURIComponent(displayName);
        
        let { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('display_name', decodedDisplayName)
          .maybeSingle();
        
        if (!data && !error) {
          const { data: usernameData, error: usernameError } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', decodedDisplayName)
            .maybeSingle();
            
          if (usernameError) {
            console.error('Error fetching profile by username:', usernameError);
          } else {
            data = usernameData;
          }
        } else if (error) {
          console.error('Error fetching profile by display name:', error);
          return;
        }
        
        if (data) {
          setProfile(data as UserProfile);
          const ownerStatus = user?.id === data.id;
          setIsOwner(ownerStatus);
          setCanEdit(ownerStatus || !!isAdmin);
          
          if (data.id) {
            fetchUserAssets(data.id);
            fetchUserVideos(data.id, user?.id, !!isAdmin);
          }
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfileByDisplayName();
  }, [displayName, user, navigate, isAdmin]);

  // Reset pagination when profile/videos change
  useEffect(() => {
    setGenerationPage(1);
    setArtPage(1);
    setLoraPage(1);
  }, [profile?.id]);

  const fetchUserAssets = async (userId: string) => {
    setIsLoadingAssets(true);
    try {
      const { data: assetsData, error: assetsError } = await supabase
        .from('assets')
        .select('*, primaryVideo:primary_media_id(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (assetsError) {
        console.error('Error fetching user assets:', assetsError);
        return;
      }

      if (assetsData) {
        const processedAssets: LoraAsset[] = assetsData.map(asset => {
          const pVideo = asset.primaryVideo; // Raw primary video data from join
          
          logger.log(`[fetchUserAssets] Processing asset: ${asset.id}, Primary Video Data (pVideo):`, {
            exists: !!pVideo,
            id: pVideo?.id,
            url: pVideo?.url, // Log the URL we expect to use
            placeholder: pVideo?.placeholder_image, // Log the placeholder image
            title: pVideo?.title
          });

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
        
        setUserAssets(processedAssets);
      }
    } catch (err) {
      console.error('Error processing user assets:', err);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const fetchUserVideos = async (userId: string, currentViewerId: string | null | undefined, isViewerAdmin: boolean) => {
    setIsLoadingVideos(true);
    setGenerationVideos([]); // Clear previous results
    setArtVideos([]); // Clear previous results

    try {
      // Step 1: Fetch user's videos from media table
      const { data: videosData, error: videosError } = await supabase
        .from('media')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'video')
        .order('created_at', { ascending: false });
    
      if (videosError) {
        console.error('Error fetching user videos:', videosError);
        toast.error("Failed to load user's videos.");
        return;
      }

      if (!videosData || videosData.length === 0) {
        console.log('No videos found for this user.');
        setIsLoadingVideos(false);
        return; // Exit early if no videos
      }

      console.log('Raw videos data:', videosData.map(video => ({
        id: video.id,
        classification: video.classification,
        title: video.title
      })));

      // Step 2: Fetch asset associations for these videos
      const videoIds = videosData.map(v => v.id);
      const mediaIdToAssetId = new Map<string, string>();

      if (videoIds.length > 0) {
        const { data: assetLinks, error: linksError } = await supabase
          .from('asset_media')
          .select('media_id, asset_id')
          .in('media_id', videoIds);

        if (linksError) {
          // Log error but proceed, videos might just not be linked
          console.error('Error fetching asset_media links:', linksError);
          toast.warning("Could not determine LoRA links for some videos.");
        } else if (assetLinks) {
          assetLinks.forEach(link => {
            if (link.media_id && link.asset_id) {
              // Assuming one video links to at most one asset in this context?
              // If multiple are possible, this will only keep the last one encountered.
              mediaIdToAssetId.set(link.media_id, link.asset_id);
            }
          });
          console.log('Built mediaId -> assetId map:', mediaIdToAssetId);
        }
      }

      // Step 3: Process videos, adding associatedAssetId
      const processedVideos: VideoEntry[] = videosData.map(video => {
        let classification = video.classification || 'generation';
        if (classification !== 'art' && classification !== 'generation') {
          logger.log(`Defaulting video ${video.id} classification from '${video.classification}' to 'generation'`);
          classification = 'generation';
        }
        
        const associatedAssetId = mediaIdToAssetId.get(video.id) || null;
        
        const processedVideo: VideoEntry = {
          id: video.id,
          url: video.url,
          associatedAssetId: associatedAssetId,
          reviewer_name: video.creator || '', 
          skipped: false, 
          created_at: video.created_at,
          admin_status: video.admin_status,
          // Correctly assign user_status (Profile page context)
          user_status: video.user_status as VideoDisplayStatus || null, 
          // assetMediaDisplayStatus would be fetched/set differently on asset pages
          assetMediaDisplayStatus: null, // Set to null for profile page context
          user_id: video.user_id,
          metadata: {
            title: video.title || '',
            description: video.description || '',
            creator: 'self', 
            classification: classification as 'art' | 'generation', 
            placeholder_image: video.placeholder_image,
            // isPrimary is determined by asset data, not here
            assetId: associatedAssetId, // Pass assetId if available
          },
          thumbnailUrl: video.placeholder_image,
          title: video.title || '',
          description: video.description || '',
          // is_primary should be determined based on LoraAsset primary_media_id, not here
          is_primary: false, 
        };
        
        return processedVideo;
      }).filter(video => video !== null) as VideoEntry[]; 

      logger.log(`[fetchUserVideos] Processing ${processedVideos.length} videos after URL generation.`);

      // Step 4: Filter videos based on viewer permissions (only show hidden if owner/admin)
      const isViewerOwner = currentViewerId === userId;
      const canViewerSeeHidden = isViewerOwner || isViewerAdmin;
      const visibleVideos = processedVideos.filter(video => 
        canViewerSeeHidden || video.user_status !== 'Hidden'
      );
      logger.log(`[fetchUserVideos] Filtered to ${visibleVideos.length} visible videos (canViewerSeeHidden: ${canViewerSeeHidden})`);

      // Step 5: Sort videos using the helper function before setting state
      const sortedVideos = sortProfileVideos(visibleVideos); 
      logger.log(`[fetchUserVideos] Sorted visible videos:`, sortedVideos.map(v => `${v.id} (Status: ${v.user_status})`));

      // Step 6: Separate into Generation and Art, then set state
      const genVids = sortedVideos.filter(v => v.metadata?.classification === 'generation');
      const artVids = sortedVideos.filter(v => v.metadata?.classification === 'art');
      
      setGenerationVideos(genVids);
      setArtVideos(artVids);
      console.log(`Processed videos: ${genVids.length} generation, ${artVids.length} art.`);
      // Log one processed video to verify structure
      if (processedVideos.length > 0) {
          console.log('Example processed video entry:', processedVideos[0]);
      }

    } catch (err) {
      console.error('Error processing user videos:', err);
      toast.error("An error occurred while loading the user's videos.");
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Helper to get paginated items for a given page and calculated size
  const getPaginatedItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
    if (pageSize <= 0) return items; // Avoid division by zero or negative index
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  };

  // Helper to get total pages based on total items and calculated size
  const getTotalPages = (totalItems: number, pageSize: number): number => {
    if (pageSize <= 0 || totalItems <= pageSize) return 1; // Only 1 page if size invalid or items fit
    return Math.ceil(totalItems / pageSize);
  };

  const currentGenerationVideos = getPaginatedItems(generationVideos, generationPage, calculatePageSize(generationVideos.length));
  const currentArtVideos = getPaginatedItems(artVideos, artPage, calculatePageSize(artVideos.length));

  const totalGenerationPages = getTotalPages(generationVideos.length, calculatePageSize(generationVideos.length));
  const totalArtPages = getTotalPages(artVideos.length, calculatePageSize(artVideos.length));
  const totalLoraPages = getTotalPages(userAssets.length, calculatePageSize(userAssets.length));

  const handleGenerationPageChange = (newPage: number) => {
    setGenerationPage(newPage);
  };

  const handleArtPageChange = (newPage: number) => {
    setArtPage(newPage);
  };

  const handleLoraPageChange = (newPage: number) => {
    setLoraPage(newPage);
  };

  // --- Prepare items for Masonry, including dummies ---
  
  // Update return type to Array<T>
  const getItemsForPage = <T extends VideoEntry | LoraAsset> (
    allItems: T[],
    page: number,
    assetType: 'video' | 'lora' // assetType might be removable now if not used for logging/debugging
  ): Array<T> => {
    const totalItems = allItems.length;
    const pageSize = calculatePageSize(totalItems); // Calculate dynamic page size
    const paginatedItems = getPaginatedItems(allItems, page, pageSize);

    // logger.log(`[getItemsForPage - ${assetType}] Total: ${totalItems}, Page: ${page}, PageSize: ${pageSize}, Displaying: ${paginatedItems.length}`);

    return paginatedItems; // Return only the real items for the current page
  };

  // --- Calculate items for page --- 
  // Type will now be Array<VideoEntry> or Array<LoraAsset>
  const generationItemsForPage = getItemsForPage(generationVideos, generationPage, 'video');
  const artItemsForPage = getItemsForPage(artVideos, artPage, 'video');
  const loraItemsForPage = getItemsForPage(userAssets, loraPage, 'lora');
  // --- End Calculate --- 

  // --- Remove independent dummy generation ---
  // const dummyItemsToRender = generateDummyItems(6, 0); 
  // --- End Remove ---

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const renderProfileLinks = () => {
    if (!profile?.links || profile.links.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {profile.links.map((link, index) => {
          try {
            const url = new URL(link);
            const domain = url.hostname;
            
            return (
              <HoverCard key={index}>
                <HoverCardTrigger asChild>
                  <a 
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex items-center justify-center w-10 h-10 bg-accent/30 hover:bg-accent/50 rounded-full transition-colors shadow-sm hover:shadow-md"
                  >
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                      alt=""
                      className="w-5 h-5"
                    />
                  </a>
                </HoverCardTrigger>
                <HoverCardContent className="p-2 text-sm glass">
                  {domain}
                </HoverCardContent>
              </HoverCard>
            );
          } catch (e) {
            return null; // Skip invalid URLs
          }
        })}
      </div>
    );
  };

  const handleOpenLightbox = (video: VideoEntry) => {
    setLightboxVideo(video);
  };

  const handleCloseLightbox = () => {
    setLightboxVideo(null);
  };

  // --- Local State Update Handlers ---

  // Handles status updates triggered from VideoCard controls
  const handleLocalVideoUserStatusUpdate = useCallback((videoId: string, newStatus: VideoDisplayStatus) => {
    logger.log(`[UserProfilePage] handleLocalVideoUserStatusUpdate called for video ${videoId} with status ${newStatus}`);
    
    const updateUserStatus = (video: VideoEntry) => 
      video.id === videoId ? { ...video, user_status: newStatus } : video;

    setUserVideos(prev => sortProfileVideos(prev.map(updateUserStatus)));
    setGenerationVideos(prev => sortProfileVideos(prev.map(updateUserStatus)));
    setArtVideos(prev => sortProfileVideos(prev.map(updateUserStatus)));
    
    logger.log(`[UserProfilePage] Local video states updated for ${videoId}`);
  }, [logger]); // Dependencies managed by useCallback

  // Delete video (already handles local state update correctly)
  const deleteVideo = async (videoId: string) => {
    logger.log(`[deleteVideo] Initiated for video ID: ${videoId}`);
    if (!canEdit) { 
      logger.warn(`[deleteVideo] Permission denied: User cannot edit this profile. Video ID: ${videoId}`);
      toast.error("You don't have permission to delete videos on this profile.");
      return;
    }

    logger.log(`[deleteVideo] User authorized. Proceeding with deletion for video ID: ${videoId}`);
    try {
      logger.log(`[deleteVideo] Attempting to fetch media record for ID: ${videoId}`);
      const { data: mediaRecord, error: fetchError } = await supabase
        .from('media')
        .select('url, placeholder_image')
        .eq('id', videoId)
        .single();

      if (fetchError || !mediaRecord) {
        logger.error(`[deleteVideo] Failed to fetch media record ${videoId}:`, fetchError);
        throw new Error(`Could not fetch media record ${videoId}.`);
      }
      logger.log(`[deleteVideo] Successfully fetched media record for ID: ${videoId}`, mediaRecord);
      
      const videoPath = mediaRecord.url;
      const thumbnailPath = mediaRecord.placeholder_image;
      logger.log(`[deleteVideo] Video URL: ${videoPath || 'N/A'}, Thumbnail path: ${thumbnailPath || 'N/A'} for ID: ${videoId}`);

      const extractRelativePath = (url: string | null | undefined, bucketName: string): string | null => {
        if (!url) return null;
        try {
          const urlObject = new URL(url);
          // Pathname looks like /storage/v1/object/public/bucketName/filePath
          const pathSegments = urlObject.pathname.split('/');
          const bucketIndex = pathSegments.findIndex(segment => segment === bucketName);
          if (bucketIndex !== -1 && bucketIndex + 1 < pathSegments.length) {
            const relativePath = pathSegments.slice(bucketIndex + 1).join('/');
            logger.log(`[extractRelativePath] Extracted path '${relativePath}' for bucket '${bucketName}' from URL ${url}`);
            return relativePath;
          }
          logger.warn(`[extractRelativePath] Could not find bucket '${bucketName}' in path segments for URL: ${url}`);
        } catch (e) {
          logger.error(`[extractRelativePath] Error parsing URL ${url}:`, e);
        }
        // Fallback or error case: return null if path extraction fails
        return null; 
      };

      if (videoPath) {
        const relativeVideoPath = extractRelativePath(videoPath, 'videos');
        if (relativeVideoPath) {
          logger.log(`[deleteVideo] Attempting to delete video file from 'videos' bucket with relative path: ${relativeVideoPath}`);
          try {
            const { data: deleteData, error: storageVideoError } = await supabase.storage
              .from('videos')
              .remove([relativeVideoPath]); // Use extracted relative path
            if (storageVideoError) {
              logger.warn(`[deleteVideo] Failed to delete video file '${relativeVideoPath}' from storage (non-blocking):`, storageVideoError);
              toast.warning(`Could not delete video file from storage.`);
            } else {
              logger.log(`[deleteVideo] Successfully deleted video file '${relativeVideoPath}' from storage.`, deleteData);
            }
          } catch (storageError) {
            logger.warn(`[deleteVideo] Exception during video file storage deletion for '${relativeVideoPath}' (non-blocking):`, storageError);
            toast.warning(`Error occurred during video file deletion.`);
          }
        } else {
          logger.warn(`[deleteVideo] Could not extract relative path from video URL: ${videoPath}. Skipping storage deletion.`);
          toast.warning(`Could not determine the storage path for the video file.`);
        }
      } else {
         logger.log(`[deleteVideo] No url found for media record ${videoId}. Skipping video storage deletion.`);
      }
      
      if (thumbnailPath) {
        const relativeThumbnailPath = extractRelativePath(thumbnailPath, 'thumbnails');
        if (relativeThumbnailPath) {
          logger.log(`[deleteVideo] Attempting to delete thumbnail file from 'thumbnails' bucket with relative path: ${relativeThumbnailPath}`);
          try {
            const { data: deleteData, error: storageThumbnailError } = await supabase.storage
              .from('thumbnails')
              .remove([relativeThumbnailPath]); // Use extracted relative path
            if (storageThumbnailError) {
              logger.warn(`[deleteVideo] Failed to delete thumbnail file '${relativeThumbnailPath}' from storage (non-blocking):`, storageThumbnailError);
              toast.warning(`Could not delete thumbnail file from storage.`);
            } else {
              logger.log(`[deleteVideo] Successfully deleted thumbnail file '${relativeThumbnailPath}' from storage.`, deleteData);
            }
          } catch (storageError) {
            logger.warn(`[deleteVideo] Exception during thumbnail file storage deletion for '${relativeThumbnailPath}' (non-blocking):`, storageError);
            toast.warning(`Error occurred during thumbnail file deletion.`);
          }
        } else {
          logger.warn(`[deleteVideo] Could not extract relative path from thumbnail URL: ${thumbnailPath}. Skipping storage deletion.`);
          toast.warning(`Could not determine the storage path for the thumbnail file.`);
        }
      } else {
          logger.log(`[deleteVideo] No placeholder_image found for media record ${videoId}. Skipping thumbnail storage deletion.`);
      }

      logger.log(`[deleteVideo] Attempting to delete media record from database for ID: ${videoId}`);
      const { error: dbError } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);

      if (dbError) {
        logger.error(`[deleteVideo] Failed to delete media record ${videoId} from database:`, dbError);
        throw dbError;
      }
      logger.log(`[deleteVideo] Successfully deleted media record from database for ID: ${videoId}`);

      setUserVideos(prev => sortProfileVideos(prev.filter(video => video.id !== videoId)));
      setGenerationVideos(prev => sortProfileVideos(prev.filter(video => video.id !== videoId)));
      setArtVideos(prev => sortProfileVideos(prev.filter(video => video.id !== videoId)));
      
      toast.success('Video deleted successfully');
      logger.log(`[deleteVideo] Deletion successful for ID: ${videoId}. Local state updated.`);

    } catch (error) {
      logger.error(`[deleteVideo] Error during deletion process for video ID ${videoId}:`, error);
      toast.error(`Failed to delete video: ${error.message || 'Unknown error'}`);
    }
    logger.log(`[deleteVideo] Finished for video ID: ${videoId}`);
  };

  // Approve/Reject might be removable later, keeping for now but ensure they sort
  const approveVideo = async (id: string) => {
    try {
      await supabase
        .from('media')
        .update({ admin_status: 'Curated' })
        .eq('id', id);
      
      setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Curated' } : video)));
      setGenerationVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Curated' } : video)));
      setArtVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Curated' } : video)));
    } catch (error) {
      console.error('Error approving video:', error);
    }
  };

  const rejectVideo = async (id: string) => {
    try {
      await supabase
        .from('media')
        .update({ admin_status: 'Rejected' })
        .eq('id', id);
      
      setUserVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Rejected' } : video)));
      setGenerationVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Rejected' } : video)));
      setArtVideos(prev => sortProfileVideos(prev.map(video => video.id === id ? { ...video, admin_status: 'Rejected' } : video)));
    } catch (error) {
      console.error('Error rejecting video:', error);
    }
  };

  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    if (isHovering) {
      setHoveredVideoId(videoId);
    } else if (hoveredVideoId === videoId) {
      setHoveredVideoId(null);
    }
  };

  // Masonry breakpoint configuration
  const breakpointColumnsObj = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  };

  // Helper to render Pagination controls
  const renderPaginationControls = (
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void
  ) => {
    if (totalPages <= 1) return null;

    return (
      <Pagination className="mt-6">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1) {
                  onPageChange(currentPage - 1);
                }
              }}
              aria-disabled={currentPage === 1}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
          {[...Array(totalPages)].map((_, i) => {
            const page = i + 1;
            // Basic pagination display - show first, last, current, and neighbors
            // A more complex implementation could show ellipsis
            if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(page);
                    }}
                    isActive={page === currentPage}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              );
            } else if (Math.abs(page - currentPage) === 2) {
              // Show ellipsis if the page is 2 away from current
              return <PaginationEllipsis key={`ellipsis-${page}`} />;
            }
            return null;
          })}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) {
                  onPageChange(currentPage + 1);
                }
              }}
              aria-disabled={currentPage === totalPages}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-gradient-to-b from-cream-light to-olive-light text-foreground">
      <Helmet>
        {/* Basic Meta Tags */}
        <title>{profile ? `${profile.display_name || profile.username}'s Profile` : 'User Profile'} | OpenMuse</title>
        <meta 
          name="description" 
          content={profile?.description ? profile.description.substring(0, 160) : `View the profile, LoRAs, and videos created by ${profile?.display_name || profile?.username || 'this user'} on OpenMuse.`} 
        />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={profile ? `${profile.display_name || profile.username}'s Profile | OpenMuse` : 'User Profile | OpenMuse'} />
        <meta 
          property="og:description" 
          content={profile?.description ? profile.description.substring(0, 160) : `View the profile, LoRAs, and videos created by ${profile?.display_name || profile?.username || 'this user'} on OpenMuse.`} 
        />
        {/* Use background image first if available, fallback to avatar */}
        <meta property="og:image" content={profile?.background_image_url || profile?.avatar_url || '/placeholder.svg'} /> 
        {profile?.username && <meta property="profile:username" content={profile.username} />} 

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={window.location.href} />
        <meta name="twitter:title" content={profile ? `${profile.display_name || profile.username}'s Profile | OpenMuse` : 'User Profile | OpenMuse'} />
        <meta 
          name="twitter:description" 
          content={profile?.description ? profile.description.substring(0, 160) : `View the profile, LoRAs, and videos created by ${profile?.display_name || profile?.username || 'this user'} on OpenMuse.`} 
        />
        {/* Use background image first if available, fallback to avatar */}
        <meta name="twitter:image" content={profile?.background_image_url || profile?.avatar_url || '/placeholder.svg'} />
      </Helmet>

      <Navigation />
      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
        <PageHeader
          title=""
          description=""
        />
        
        {!isLoading && (
          <>
            <div className="max-w-2xl mx-auto">
              {isOwner && !forceLoggedOutView ? (
                <UserProfileSettings />
              ) : (
                <Card className="w-full overflow-hidden shadow-lg bg-white/10 backdrop-blur-sm border border-white/20 animate-scale-in">
                  {profile?.background_image_url && (
                    <div 
                      className="w-full h-48 bg-cover bg-center rounded-t-lg" 
                      style={{ backgroundImage: `url(${profile.background_image_url})` }}
                    />
                  )}
                  <CardContent className={`pt-6 pb-4 ${profile?.background_image_url ? '-mt-16 relative z-10 bg-gradient-to-t from-card to-transparent' : ''}`}>
                    <div className="flex flex-col items-center space-y-4">
                      <Avatar className={`h-24 w-24 border-4 border-white shadow-xl ${profile?.background_image_url ? '-mt-13' : ''}`}>
                        <AvatarImage src={profile?.avatar_url || ''} alt={profile?.display_name || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                          {profile ? getInitials(profile.display_name || profile.username) : '??'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="text-center">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-forest-dark to-olive-dark bg-clip-text text-transparent">
                          {profile?.display_name}
                        </h2>
                        
                        {profile?.real_name && (
                          <p className="text-muted-foreground mt-1">{profile.real_name}</p>
                        )}
                        
                        <p className="text-muted-foreground text-sm">{profile?.username}</p>
                        
                        {profile?.description && (
                          <div className="mt-4 max-w-md mx-auto">
                            <p className="text-sm text-foreground/90 bg-muted/20 p-3 rounded-lg">{profile.description}</p>
                          </div>
                        )}
                        
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
                {isOwner && profile?.id && !forceLoggedOutView && (
                  <UploadModal
                    trigger={
                      <Button className="bg-gradient-to-r from-forest to-olive hover:from-forest-dark hover:to-olive-dark transition-all duration-300"> 
                        Add new LoRA
                      </Button>
                    }
                    initialUploadType="lora"
                    onUploadSuccess={() => fetchUserAssets(profile.id)}
                  />
                )}
              </CardHeader>
              <CardContent>
                {isLoadingAssets ? (
                  <LoraGallerySkeleton count={isMobile ? 2 : 6} />
                ) : userAssets.length > 0 ? (
                  <>
                    <div className="relative pt-6"> 
                      <Masonry
                        breakpointCols={breakpointColumnsObj}
                        className="my-masonry-grid"
                        columnClassName="my-masonry-grid_column"
                      >
                        {loraItemsForPage.map(item => (
                          <LoraCard 
                            key={item.id} 
                            lora={item}
                            isAdmin={isAdmin}
                          />
                        ))}
                      </Masonry>
                    </div>
                    {totalLoraPages > 1 && renderPaginationControls(loraPage, totalLoraPages, handleLoraPageChange)}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg">
                    This user hasn't created any LoRAs yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-gold-light/30 backdrop-blur-sm border border-gold-dark/20 animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-gold/10 to-cream/10">
                <CardTitle className="text-gold-dark">Generations</CardTitle>
                {isOwner && profile?.id && !forceLoggedOutView && (
                  <UploadModal
                    trigger={
                      <Button className="bg-gradient-to-r from-gold-dark to-gold hover:opacity-90 transition-all duration-300">
                        Add new Generation
                      </Button>
                    }
                    initialUploadType="video"
                    onUploadSuccess={() => fetchUserVideos(profile.id, user?.id, !!isAdmin)}
                  />
                )}
              </CardHeader>
              <CardContent>
                {isLoadingVideos ? (
                  <LoraGallerySkeleton count={isMobile ? 2 : 6} />
                ) : generationVideos.length > 0 ? ( // Render if there are ANY generation videos
                  <>
                    <div className="relative pt-6"> 
                      <Masonry
                        breakpointCols={breakpointColumnsObj}
                        className="my-masonry-grid"
                        columnClassName="my-masonry-grid_column"
                      >
                        {generationItemsForPage.map((item) => (
                          <VideoCard
                            key={item.id}
                            video={item}
                            isAdmin={canEdit}
                            isAuthorized={isOwner || !!isAdmin}
                            onOpenLightbox={handleOpenLightbox}
                            onApproveVideo={approveVideo}
                            onRejectVideo={rejectVideo}
                            onDeleteVideo={deleteVideo}
                            isHovering={hoveredVideoId === item.id}
                            onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)}
                            onStatusUpdateComplete={() => fetchUserVideos(profile.id, user?.id, !!isAdmin)}
                            onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate}
                          />
                        ))}
                      </Masonry>
                    </div>
                    {totalGenerationPages > 1 && renderPaginationControls(generationPage, totalGenerationPages, handleGenerationPageChange)}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg">
                    This user hasn't generated any videos yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-8 mb-8 overflow-hidden shadow-lg bg-gradient-to-br from-card to-olive-light/30 backdrop-blur-sm border border-olive-dark/20 animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-olive/10 to-cream/10">
                <CardTitle className="text-olive-dark">Art</CardTitle>
                {isOwner && profile?.id && !forceLoggedOutView && (
                  <UploadModal
                    trigger={
                      <Button className="bg-gradient-to-r from-olive-dark to-olive hover:opacity-90 transition-all duration-300">
                        Add new Art
                      </Button>
                    }
                    initialUploadType="video"
                    onUploadSuccess={() => fetchUserVideos(profile.id, user?.id, !!isAdmin)}
                  />
                )}
              </CardHeader>
              <CardContent>
                {isLoadingVideos ? (
                  <LoraGallerySkeleton count={isMobile ? 2 : 4} />
                ) : artVideos.length > 0 ? ( // Render if there are ANY art videos
                  <>
                    <div className="relative pt-6">
                      <Masonry
                        breakpointCols={breakpointColumnsObj}
                        className="my-masonry-grid"
                        columnClassName="my-masonry-grid_column"
                      >
                        {artItemsForPage.map((item) => (
                          <VideoCard
                            key={item.id}
                            video={item}
                            isAdmin={canEdit}
                            isAuthorized={isOwner || !!isAdmin}
                            onOpenLightbox={handleOpenLightbox}
                            onApproveVideo={approveVideo}
                            onRejectVideo={rejectVideo}
                            onDeleteVideo={deleteVideo}
                            isHovering={hoveredVideoId === item.id}
                            onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)}
                            onStatusUpdateComplete={() => fetchUserVideos(profile.id, user?.id, !!isAdmin)}
                            onUpdateLocalVideoStatus={handleLocalVideoUserStatusUpdate}
                          />
                        ))}
                      </Masonry>
                    </div>
                    {totalArtPages > 1 && renderPaginationControls(artPage, totalArtPages, handleArtPageChange)}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8 bg-muted/20 rounded-lg">
                    This user hasn't added any art videos yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {lightboxVideo && (
        <VideoLightbox
          isOpen={!!lightboxVideo}
          onClose={handleCloseLightbox}
          videoUrl={lightboxVideo.url}
          videoId={lightboxVideo.id}
          title={lightboxVideo.metadata?.title}
          description={lightboxVideo.metadata?.description}
          initialAssetId={lightboxVideo.associatedAssetId ?? undefined}
          creator={lightboxVideo.user_id || lightboxVideo.metadata?.creatorName}
          thumbnailUrl={lightboxVideo.placeholder_image || lightboxVideo.metadata?.placeholder_image}
          creatorId={lightboxVideo.user_id}
          onVideoUpdate={() => {
            if (profile?.id) {
              console.log('[UserProfilePage] Lightbox update triggered. Refetching videos for user:', profile.id);
              fetchUserVideos(profile.id, user?.id, !!isAdmin);
            } else {
              console.warn('[UserProfilePage] Cannot refresh videos via lightbox: Profile ID missing.');
            }
          }}
        />
      )}

      <Footer />
    </div>
  );
}
