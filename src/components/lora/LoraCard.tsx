import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LoraAsset } from '@/lib/types';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Trash, Check, X, ExternalLink, ArrowUpRight, PinIcon, List, EyeOff, Loader2 } from 'lucide-react';
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
import LoraCreatorInfo from './LoraCreatorInfo';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';

const logger = new Logger('LoraCard');

// Define the possible user preference statuses
export type UserAssetPreferenceStatus = 'Pinned' | 'Listed' | 'Hidden';

interface LoraCardProps {
  lora: LoraAsset;
  isAdmin?: boolean;
  isOwnProfile?: boolean;
  userStatus?: UserAssetPreferenceStatus | null;
  onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
  hideCreatorInfo?: boolean;
  isUpdatingStatus?: boolean;
  onVisibilityChange?: (loraId: string, isVisible: boolean) => void;
  shouldBePlaying?: boolean;
  onEnterPreloadArea?: (loraId: string, isInPreloadArea: boolean) => void;
  /** Optional override for aspect ratio, defaults to metadata or 16:9 on profile/home */
  aspectRatioOverride?: number;
}

const LoraCard: React.FC<LoraCardProps> = ({ 
  lora, 
  isAdmin = false, 
  isOwnProfile = false,
  userStatus = null,
  onUserStatusChange,
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
  const [currentStatus, setCurrentStatus] = useState(userStatus);
  const { user } = useAuth();
  // Initialize aspect ratio from metadata if it already exists to avoid layout shift on initial render
  const [aspectRatio, setAspectRatio] = useState<number | null>(
    lora?.primaryVideo?.metadata?.aspectRatio ?? null
  );
  const finalAspectRatio = aspectRatioOverride != null
    ? aspectRatioOverride
    : (isOnProfilePage || isOnHomePage ? 16/9 : aspectRatio);
  const [isVisible, setIsVisible] = useState(false);
  const [isInPreloadArea, setIsInPreloadArea] = useState(false);
  const isMobile = useIsMobile();
  const previewRef = useRef<HTMLDivElement>(null);
  useFadeInOnScroll(previewRef);
  
  useEffect(() => {
    setCurrentStatus(userStatus);
  }, [userStatus]);

  const videoUrl = lora.primaryVideo?.url;
  const thumbnailUrl = lora.primaryVideo?.metadata?.placeholder_image;
  
  const getModelColor = (modelType?: string): string => {
    switch (modelType?.toLowerCase()) {
      case 'wan':
        return "bg-blue-200 text-blue-800";
      case 'hunyuan':
        return "bg-purple-200 text-purple-800";
      case 'ltxv':
        return "bg-yellow-200 text-yellow-800";
      case 'cogvideox':
        return "bg-emerald-200 text-emerald-800";
      case 'animatediff':
        return "bg-pink-200 text-pink-800";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };
  
  const getModelDisplay = (): string => {
    const baseModel = lora.lora_base_model?.toUpperCase();
    const variant = lora.model_variant;
    
    if (!baseModel && !variant) {
      return '';
    }
    
    const displayBase = baseModel || 'UNKNOWN';
    const displayVariant = variant ? ` (${variant})` : '';
    return `${displayBase}${displayVariant}`;
  };
  
  const handleView = () => {
    navigate(`/assets/loras/${lora.id}`);
  };
  
  const handleDelete = async () => {
    if (!isAdmin) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', lora.id);
      
      if (error) throw error;
      
      toast.success('LoRA deleted successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error deleting LoRA:', error);
      toast.error('Failed to delete LoRA');
    } finally {
      setIsDeleting(false);
    }
  };
  
  const updateAssetStatus = async (newStatus: UserAssetPreferenceStatus) => {
    if (!user || !isOwnProfile || !onUserStatusChange) return;

    const optimisticPreviousStatus = currentStatus;
    setCurrentStatus(newStatus);

    let setStateFunc: React.Dispatch<React.SetStateAction<boolean>>;
    if (newStatus === 'Pinned') setStateFunc = setIsPinning;
    else if (newStatus === 'Listed') setStateFunc = setIsListing;
    else setStateFunc = setIsHiding;

    setStateFunc(true);

    try {
      await onUserStatusChange(lora.id, newStatus);
    } catch (error) {
      console.error(`Error setting status to ${newStatus}:`, error);
      toast.error(`Failed to set status to ${newStatus}`);
      setCurrentStatus(optimisticPreviousStatus);
    } finally {
      setStateFunc(false);
    }
  };

  const handlePin = () => updateAssetStatus('Pinned');
  const handleSetListed = () => updateAssetStatus('Listed');
  const handleHide = () => updateAssetStatus('Hidden');
  
  const getStatusButtonStyle = (status: UserAssetPreferenceStatus) => {
    const isActive = currentStatus === status;
    
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
      onVisibilityChange(lora.id, visible);
    }
  }, [lora.id, onVisibilityChange]);

  const handleEnterPreloadArea = useCallback((inArea: boolean) => {
    setIsInPreloadArea(inArea);
    if (onEnterPreloadArea) {
      onEnterPreloadArea(lora.id, inArea);
    }
  }, [lora.id, onEnterPreloadArea]);

  // Keep aspect ratio in sync if the primary video (or its metadata) changes later
  useEffect(() => {
    const metaRatio = lora?.primaryVideo?.metadata?.aspectRatio ?? null;
    if (metaRatio && aspectRatio === null) {
      setAspectRatio(metaRatio);
    }
  }, [lora?.primaryVideo?.metadata?.aspectRatio, aspectRatio]);

  return (
    <Card onClick={handleView} className="relative overflow-hidden shadow-lg group transition-all duration-300 ease-in-out hover:shadow-xl border-transparent hover:border-primary/30 bg-card/70 backdrop-blur-sm">
      <div 
        ref={previewRef}
        className="w-full overflow-hidden bg-muted relative"
        style={finalAspectRatio != null
          ? { paddingBottom: `${(1 / finalAspectRatio) * 100}%` }
          : { aspectRatio: '16 / 9' }
        }
      >
        {videoUrl ? (
          <>
            <div className="absolute inset-0">
              <VideoPreview 
                url={videoUrl} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out" 
                title={lora.name}
                lazyLoad={false}
                thumbnailUrl={thumbnailUrl}
                onLoadedData={handleVideoLoad}
                onVisibilityChange={handleVisibilityChange}
                shouldBePlaying={shouldBePlaying}
                onEnterPreloadArea={handleEnterPreloadArea}
              />
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
            
            {/* --- Top Right Open Icon --- */}
            <div className="absolute top-3 right-3 z-10">
              <div className={cn(
                "transition-opacity duration-300",
                !isMobile && "opacity-0 group-hover:opacity-100" // Only fade on non-mobile
              )}>
                <div className="bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-md border border-white/20 group-hover:animate-subtle-pulse">
                  <ArrowUpRight className="h-3 w-3 text-primary" />
                </div>
              </div>
            </div>

            {/* --- Top Left LoRA Type Badge --- */}
            {lora.lora_type && (
              <div className="absolute top-3 left-3 z-10">
                <div className={cn(
                  "transition-opacity duration-300",
                  !isMobile && "opacity-0 group-hover:opacity-100" // Only fade on non-mobile
                )}>
                  <Badge 
                    variant="secondary" 
                    className="bg-white/80 backdrop-blur-sm shadow-md border border-white/20 text-xs px-1.5 py-0.5 h-auto"
                  >
                    {lora.lora_type}
                  </Badge>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No preview available</p>
          </div>
        )}
      </div>
      
      <CardContent className="p-3 flex-grow">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            {isOnProfilePage && (lora.admin_status === 'Curated' || lora.admin_status === 'Featured') && (
              <img
                src="/reward.png"
                alt="Featured by OpenMuse"
                title="Featured by OpenMuse"
                className="h-6 w-6 mr-2 transition-transform duration-200 group-hover:scale-110"
              />
            )}
            <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{lora.name}</h3>
          </div>
          {getModelDisplay() && (
            <Badge
              variant="model"
              className={cn("ml-2 text-xs px-2 py-0.5 h-5", getModelColor(lora.lora_base_model))}
            >
              {getModelDisplay()}
            </Badge>
          )}
        </div>
        {!hideCreatorInfo && (
          <LoraCreatorInfo 
            asset={lora} 
            avatarSize="h-5 w-5" 
            textSize="text-xs" 
            className="text-muted-foreground mt-1"
          />
        )}
      </CardContent>
      
      {isOwnProfile && (
        <CardFooter className="p-3 border-t" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-3 gap-2 w-full">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePin}
              disabled={isPinning || isListing || isHiding || isUpdatingStatus}
              className={getStatusButtonStyle('Pinned')}
            >
              {isUpdatingStatus && currentStatus === 'Pinned' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PinIcon className="mr-2 h-4 w-4" />}
              Pin
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSetListed}
              disabled={isPinning || isListing || isHiding || isUpdatingStatus}
              className={getStatusButtonStyle('Listed')}
            >
              {isUpdatingStatus && currentStatus === 'Listed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
              List
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleHide}
              disabled={isPinning || isListing || isHiding || isUpdatingStatus}
              className={getStatusButtonStyle('Hidden')}
            >
              {isUpdatingStatus && currentStatus === 'Hidden' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <EyeOff className="mr-2 h-4 w-4" />} 
              Hide
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default LoraCard;
