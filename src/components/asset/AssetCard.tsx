import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnyAsset, AdminStatus, LoraAsset, WorkflowAsset, UserAssetPreferenceStatus } from '@/lib/types'; // Updated import
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Trash, Check, X, ExternalLink, ArrowUpRight, PinIcon, List, EyeOff, Loader2, Star, ListChecks, Flame, Download } from 'lucide-react'; // Added Download
import { useNavigate, useLocation } from 'react-router-dom';
import VideoPreview from '@/components/VideoPreview';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logger } from '@/lib/logger';
import AssetCreatorInfo from './AssetCreatorInfo'; // Uncommented and path adjusted if needed (assuming it's in the same directory or ./asset/)
import { useIsMobile } from '@/hooks/use-mobile';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LoadingState from '../LoadingState'; // Assuming LoadingState is available

const logger = new Logger('AssetCard'); // Renamed logger

// UserAssetPreferenceStatus is now imported from @/lib/types

interface AssetCardProps {
  asset: AnyAsset | null; // Allow asset to be null initially for safety
  isAdmin?: boolean;
  isOwnProfile?: boolean;
  userStatus?: UserAssetPreferenceStatus | null;
  onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
  onAdminStatusChange?: (assetId: string, newStatus: AdminStatus) => Promise<void>;
  hideCreatorInfo?: boolean;
  isUpdatingStatus?: boolean;
  onVisibilityChange?: (assetId: string, isVisible: boolean) => void; // Changed loraId to assetId
  shouldBePlaying?: boolean;
  onEnterPreloadArea?: (assetId: string, isInPreloadArea: boolean) => void; // Changed loraId to assetId
  aspectRatioOverride?: number;
}

// Moved LoRA specific utility functions outside or make them take LoraAsset explicitly
const getModelColorForLora = (loraAsset: LoraAsset, modelType?: string): string => {
  switch (modelType?.toLowerCase()) {
    case 'wan': return "bg-blue-200 text-blue-800";
    case 'hunyuan': return "bg-purple-200 text-purple-800";
    case 'ltxv': return "bg-yellow-200 text-yellow-800";
    case 'ltx2': return "bg-orange-200 text-orange-800";
    case 'cogvideox': return "bg-emerald-200 text-emerald-800";
    case 'animatediff': return "bg-pink-200 text-pink-800";
    default: return "bg-gray-200 text-gray-800";
  }
};

const getModelDisplayForLora = (loraAsset: LoraAsset): string => {
  const baseModel = loraAsset.lora_base_model?.toUpperCase();
  const variant = loraAsset.model_variant;
  if (!baseModel && !variant) return '';
  const displayBase = baseModel || 'UNKNOWN';
  const displayVariant = variant ? ` (${variant})` : '';
  return `${displayBase}${displayVariant}`;
};

const AssetCard: React.FC<AssetCardProps> = ({ 
  asset, 
  isAdmin = false, 
  isOwnProfile = false,
  userStatus: initialUserStatus, // Renamed to avoid conflict with asset.user_status if directly used
  onUserStatusChange,
  onAdminStatusChange,
  hideCreatorInfo = false,
  isUpdatingStatus = false,
  onVisibilityChange,
  shouldBePlaying = false,
  onEnterPreloadArea,
  aspectRatioOverride,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnProfilePage = location.pathname.startsWith('/profile/');
  const isOnHomePage = location.pathname === '/';
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isChangingAdminStatus, setIsChangingAdminStatus] = useState(false);
  const [currentAssetUserStatus, setCurrentAssetUserStatus] = useState(asset?.user_status ?? initialUserStatus ?? null);
  const { user } = useAuth();
  const [aspectRatio, setAspectRatio] = useState<number | null>(
    asset?.primaryVideo?.metadata?.aspectRatio ?? null
  );
  const finalAspectRatio = aspectRatioOverride != null
    ? aspectRatioOverride
    : (isOnProfilePage || isOnHomePage ? 16/9 : aspectRatio);
  const [isVisible, setIsVisible] = useState(false);
  const [isInPreloadArea, setIsInPreloadArea] = useState(false);
  const isMobile = useIsMobile();
  const previewRef = useRef<HTMLDivElement>(null);
  useFadeInOnScroll(previewRef);
  const [isCardHovering, setIsCardHovering] = useState(false);
  
  useEffect(() => {
    setCurrentAssetUserStatus(asset?.user_status ?? initialUserStatus ?? null);
  }, [asset?.user_status, initialUserStatus]);

  // Early return if no asset prop is provided (e.g., while loading parent data)
  if (!asset) {
    // Render a placeholder or null, or a very basic skeleton
    return <Card className="h-[300px] flex items-center justify-center"><LoadingState/></Card>; 
  }

  // Add an explicit check for asset.type to see if it resolves the 'never' issue.
  if (typeof asset.type === 'undefined') {
    // This case should ideally not be reached if AnyAsset is correctly defined
    // and the initial null check for asset itself has passed.
    logger.error('[AssetTypeError] Asset type is undefined after null check. Asset:', asset);
    // Render a fallback or error state, or return null to prevent further rendering errors.
    return <Card className="h-[300px] flex items-center justify-center"><p>Error: Asset type is undefined.</p></Card>;
  }

  // Now that asset is guaranteed to be non-null, we can destructure or use its properties.
  const primaryVideo = asset.primaryVideo;
  const actualVideoUrl = primaryVideo?.storage_provider === 'cloudflare-stream' && primaryVideo.cloudflare_playback_hls_url
    ? primaryVideo.cloudflare_playback_hls_url
    : primaryVideo?.url;
  
  const actualThumbnailUrl = primaryVideo?.storage_provider === 'cloudflare-stream' && primaryVideo.cloudflare_thumbnail_url
    ? primaryVideo.cloudflare_thumbnail_url
    : primaryVideo?.placeholder_image || primaryVideo?.metadata?.placeholder_image;

  const handleView = () => {
    if (asset.type === 'lora') {
      navigate(`/assets/loras/${asset.id}`);
    } else if (asset.type === 'workflow') {
      navigate(`/assets/workflows/${asset.id}`);
    } else {
      logger.warn('Unknown asset type for view action:', (asset as any).type);
    }
  };
  
  const handleDelete = async () => {
    if (!isAdmin) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', asset.id);
      if (error) throw error;
      toast.success(`${asset.type.charAt(0).toUpperCase() + asset.type.slice(1)} deleted successfully`);
      window.location.reload(); // Consider a less disruptive update
    } catch (error) {
      console.error(`Error deleting ${asset.type}:`, error);
      toast.error(`Failed to delete ${asset.type}`);
    } finally {
      setIsDeleting(false);
    }
  };
  
  const updateAssetUserPreferenceStatus = async (newStatus: UserAssetPreferenceStatus) => {
    if (!user || !isOwnProfile || !onUserStatusChange) return;
    const optimisticPreviousStatus = currentAssetUserStatus;
    setCurrentAssetUserStatus(newStatus);
    let setStateFunc: React.Dispatch<React.SetStateAction<boolean>>;
    if (newStatus === 'Pinned') setStateFunc = setIsPinning;
    else if (newStatus === 'Listed') setStateFunc = setIsListing;
    else setStateFunc = setIsHiding;
    setStateFunc(true);
    try {
      await onUserStatusChange(asset.id, newStatus);
    } catch (error) {
      console.error(`Error setting status to ${newStatus}:`, error);
      toast.error(`Failed to set status to ${newStatus}`);
      setCurrentAssetUserStatus(optimisticPreviousStatus);
    } finally {
      setStateFunc(false);
    }
  };

  const handleAdminStatusChangeInternal = async (newStatus: AdminStatus) => {
    if (!isAdmin || !onAdminStatusChange) return;
    setIsChangingAdminStatus(true);
    try {
      await onAdminStatusChange(asset.id, newStatus);
    } catch (error) {
      console.error(`Error setting admin status to ${newStatus}:`, error);
      toast.error(`Failed to set admin status to ${newStatus}`);
    } finally {
      setIsChangingAdminStatus(false);
    }
  };
  
  const getAdminStatusIcon = (status: AdminStatus) => {
    switch (status) {
      case 'Featured': return <Flame className="h-4 w-4 mr-2" />;
      case 'Curated': return <ListChecks className="h-4 w-4 mr-2" />;
      case 'Listed': return <List className="h-4 w-4 mr-2" />;
      case 'Hidden': return <EyeOff className="h-4 w-4 mr-2" />;
      case 'Rejected': return <X className="h-4 w-4 mr-2" />;
      default: return <List className="h-4 w-4 mr-2" />;
    }
  };

  const handlePin = () => updateAssetUserPreferenceStatus('Pinned');
  const handleSetListed = () => updateAssetUserPreferenceStatus('Listed');
  const handleHide = () => updateAssetUserPreferenceStatus('Hidden');
  
  const getStatusButtonStyle = (status: UserAssetPreferenceStatus) => {
    const isActive = currentAssetUserStatus === status;
    return cn(
      "text-xs h-8 flex-1",
      isActive && status === 'Pinned' && "bg-green-500 text-white hover:bg-green-600",
      isActive && status === 'Listed' && "bg-blue-500 text-white hover:bg-blue-600",
      isActive && status === 'Hidden' && "bg-gray-500 text-white hover:bg-gray-600",
      !isActive && "bg-transparent"
    );
  };
  
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.target as HTMLVideoElement;
    if (video.videoWidth && video.videoHeight) {
      setAspectRatio(video.videoWidth / video.videoHeight);
    }
  };

  const handleVisibilityChange = useCallback((visible: boolean) => {
    setIsVisible(visible);
    if (onVisibilityChange) {
      onVisibilityChange(asset.id, visible);
    }
  }, [asset.id, onVisibilityChange]);

  const handleEnterPreloadArea = useCallback((inArea: boolean) => {
    setIsInPreloadArea(inArea);
    if (onEnterPreloadArea) {
      onEnterPreloadArea(asset.id, inArea);
    }
  }, [asset.id, onEnterPreloadArea]);

  useEffect(() => {
    const metaRatio = asset?.primaryVideo?.metadata?.aspectRatio ?? null;
    if (metaRatio && aspectRatio === null) {
      setAspectRatio(metaRatio);
    }
  }, [asset?.primaryVideo?.metadata?.aspectRatio, aspectRatio]);

  const getAdminStatusBadgeVariant = (status: AdminStatus | undefined | null) => {
    if (!status) return "bg-gray-200 text-gray-800";
    switch (status) {
      case 'Featured': return "bg-orange-200 text-orange-800";
      case 'Curated': return "bg-green-200 text-green-800";
      case 'Listed': return "bg-blue-200 text-blue-800";
      case 'Hidden': return "bg-gray-200 text-gray-800";
      case 'Rejected': return "bg-red-200 text-red-800";
      default: return "bg-gray-200 text-gray-800";
    }
  };

  const adminStatusOptions: AdminStatus[] = ['Featured', 'Curated', 'Listed', 'Hidden', 'Rejected'];
  const statusOptionColors: Record<AdminStatus, string> = {
    'Featured': 'bg-orange-50',
    'Curated': 'bg-green-50',
    'Listed': 'bg-blue-50',
    'Hidden': 'bg-gray-50',
    'Rejected': 'bg-red-50'
  };
  
  const isStatusEqual = (status1: string | undefined | null, status2: AdminStatus): boolean => {
    return status1 === status2;
  };

  const handleDownloadWorkflow = (e: React.MouseEvent, downloadUrl: string, fileName: string) => {
    e.stopPropagation(); // Prevent card click
    const forceDownload = async (url: string, filename: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download failed:', error);
        toast.error('Failed to download workflow file');
      }
    };
    
    forceDownload(downloadUrl, fileName);
  };

  // Explicit type narrowing for rendering
  let cardSpecificContent = null;
  if (asset.type === 'lora') {
    const loraAsset = asset as LoraAsset;
    cardSpecificContent = (
      <>
        {/* Top Left LoRA Type Badge */}
        {loraAsset.lora_type && (
          <div className="absolute top-3 left-3 z-10">
            <div className={cn("transition-opacity duration-300", !isMobile && "opacity-0 group-hover:opacity-100")}>
              <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm shadow-md border border-white/20 text-xs px-1.5 py-0.5 h-auto">
                {loraAsset.lora_type}
              </Badge>
            </div>
          </div>
        )}
        {/* Model Display in CardContent */}
        {getModelDisplayForLora(loraAsset) && (
          <Badge variant="model" className={cn("ml-2 text-xs px-2 py-0.5 h-5", getModelColorForLora(loraAsset, loraAsset.lora_base_model))}>
            {getModelDisplayForLora(loraAsset)}
          </Badge>
        )}
      </>
    );
  } else if (asset.type === 'workflow') {
    const workflowAsset = asset as WorkflowAsset;
    cardSpecificContent = (
      <>
        {/* Workflow Type in CardContent (placeholder or specific if added to type) */}
        <Badge variant="secondary" className={cn("ml-2 text-xs px-2 py-0.5 h-5", "bg-sky-200 text-sky-800")}>Workflow</Badge>
      </>
    );
  }

  return (
    <Card 
      onClick={handleView} 
      onMouseEnter={() => setIsCardHovering(true)}
      onMouseLeave={() => setIsCardHovering(false)}
      className="relative overflow-hidden shadow-lg group transition-all duration-300 ease-in-out hover:shadow-xl border-transparent hover:border-primary/30 bg-card/70 backdrop-blur-sm"
    >
      <div 
        ref={previewRef}
        className="w-full overflow-hidden bg-muted relative"
        style={finalAspectRatio != null
          ? { paddingBottom: `${(1 / finalAspectRatio) * 100}%` }
          : { aspectRatio: '16 / 9' }
        }
      >
        {actualVideoUrl ? (
          <>
            <div className="absolute inset-0">
              <VideoPreview 
                url={actualVideoUrl}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out" 
                title={asset.name}
                lazyLoad={false}
                thumbnailUrl={actualThumbnailUrl}
                onLoadedData={handleVideoLoad}
                onVisibilityChange={handleVisibilityChange}
                isHovering={isCardHovering}
                shouldBePlaying={shouldBePlaying}
                onEnterPreloadArea={handleEnterPreloadArea}
              />
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
            
            <div className="absolute top-3 right-3 z-10">
              <div className={cn(
                "transition-opacity duration-300",
                !isMobile && "opacity-0 group-hover:opacity-100"
              )}>
                <div className="bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-md border border-white/20 group-hover:animate-subtle-pulse">
                  <ArrowUpRight className="h-3 w-3 text-primary" />
                </div>
              </div>
            </div>

            {/* Render badges based on asset type from cardSpecificContent or directly */}
            {asset.type === 'lora' && (asset as LoraAsset).lora_type && (
              <div className="absolute top-3 left-3 z-10">
                <div className={cn(
                  "transition-opacity duration-300",
                  !isMobile && "opacity-0 group-hover:opacity-100"
                )}>
                  <Badge 
                    variant="secondary" 
                    className="bg-white/80 backdrop-blur-sm shadow-md border border-white/20 text-xs px-1.5 py-0.5 h-auto"
                  >
                    {(asset as LoraAsset).lora_type}
                  </Badge>
                </div>
              </div>
            )}
          </>
        ) : (
          // Fallback for assets with no primary video (especially workflows)
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {asset.type === 'workflow' && asset.download_link ? (
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/assets/workflows/${asset.id}`); }} className="animate-fade-in">
                  <ArrowUpRight size={16} className="mr-2" /> View Workflow
                </Button>
                <Button variant="default" size="sm" onClick={(e) => handleDownloadWorkflow(e, asset.download_link!, asset.name ? `${asset.name}.json` : "workflow.json")} className="animate-fade-in">
                  <Download size={16} className="mr-2" /> Download
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm animate-fade-in">No preview available</p>
            )}
          </div>
        )}

        {isAdmin && onAdminStatusChange && !isOwnProfile && (
          <div className="absolute bottom-3 left-3 z-20" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-auto px-2 py-1 shadow-md bg-background/80 hover:bg-background/100 backdrop-blur-sm"
                  disabled={isChangingAdminStatus}
                >
                  {isChangingAdminStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    getAdminStatusIcon((asset.admin_status || 'Listed') as AdminStatus)
                  )}
                  <span className="sr-only">Admin Status</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Change Admin Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {adminStatusOptions.map((status) => (
                  <DropdownMenuItem 
                    key={status}
                    onClick={() => handleAdminStatusChangeInternal(status)}
                    disabled={isStatusEqual(asset.admin_status, status) || isChangingAdminStatus}
                    className={isStatusEqual(asset.admin_status, status) ? statusOptionColors[status] : ""}
                  >
                    {getAdminStatusIcon(status)}
                    <span>{status}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      
      <CardContent className="p-3 flex-grow">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            {isOnProfilePage && (asset.admin_status === 'Curated' || asset.admin_status === 'Featured') && (
              <img
                src="/reward.png"
                alt="Featured by OpenMuse"
                title="Featured by OpenMuse"
                className="h-6 w-6 mr-2 transition-transform duration-200 group-hover:scale-110"
              />
            )}
            <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{asset.name}</h3>
          </div>
          {/* Render model/workflow badge from cardSpecificContent or directly */}
          {asset.type === 'lora' && getModelDisplayForLora(asset as LoraAsset) && (
            <Badge variant="model" className={cn("ml-2 text-xs px-2 py-0.5 h-5", getModelColorForLora(asset as LoraAsset, (asset as LoraAsset).lora_base_model))}>
              {getModelDisplayForLora(asset as LoraAsset)}
            </Badge>
          )}
          {asset.type === 'workflow' && (
             <Badge
              variant="secondary"
              className={cn("ml-2 text-xs px-2 py-0.5 h-5", "bg-sky-200 text-sky-800")}
            >
              Workflow
            </Badge>
          )}
        </div>
        <div className="flex justify-between items-center">
          {!hideCreatorInfo && (
            <AssetCreatorInfo 
              asset={asset} 
              avatarSize="h-5 w-5" 
              textSize="text-xs" 
              className="text-muted-foreground mt-1"
            />
          )}
          
          {isAdmin && asset.admin_status && (
            <Badge
              variant="secondary"
              className={cn("mt-1 text-xs px-2 py-0.5 h-5", getAdminStatusBadgeVariant(asset.admin_status as AdminStatus | null))}
            >
              {asset.admin_status}
            </Badge>
          )}
        </div>
      </CardContent>
      
      {isOwnProfile && (
        <CardFooter className="p-3 border-t" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-3 gap-2 w-full">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleHide}
              disabled={isPinning || isListing || isHiding || isUpdatingStatus}
              className={getStatusButtonStyle('Hidden')}
            >
              {isUpdatingStatus && currentAssetUserStatus === 'Hidden' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <EyeOff className="mr-2 h-4 w-4" />} 
              Hide
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSetListed}
              disabled={isPinning || isListing || isHiding || isUpdatingStatus}
              className={getStatusButtonStyle('Listed')}
            >
              {isUpdatingStatus && currentAssetUserStatus === 'Listed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />} 
              List
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePin}
              disabled={isPinning || isListing || isHiding || isUpdatingStatus}
              className={getStatusButtonStyle('Pinned')}
            >
              {isUpdatingStatus && currentAssetUserStatus === 'Pinned' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PinIcon className="mr-2 h-4 w-4" />} 
              Pin
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default AssetCard; 