import React, { useState, useEffect, useRef } from 'react';
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
}

const LoraCard: React.FC<LoraCardProps> = ({ 
  lora, 
  isAdmin = false, 
  isOwnProfile = false,
  userStatus = null,
  onUserStatusChange,
  hideCreatorInfo = false,
  isUpdatingStatus = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(userStatus);
  const { user } = useAuth();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  
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
  
  const isOnProfilePage = location.pathname.startsWith('/profile/');
  
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.target as HTMLVideoElement;
    if (video.videoWidth && video.videoHeight) {
      setAspectRatio(video.videoWidth / video.videoHeight);
    }
  };

  return (
    <Card 
      className={cn(
        "relative z-10 overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow duration-200 ease-in-out group",
        isOwnProfile && currentStatus === 'Hidden' && 'opacity-60 grayscale'
      )}
      onClick={handleView}
    >
      <div 
        className="w-full overflow-hidden bg-muted relative"
        style={aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : { aspectRatio: '16/9' }}
      >
        {videoUrl ? (
          <>
            <div className="absolute inset-0">
              <VideoPreview 
                url={videoUrl} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out" 
                title={lora.name}
                lazyLoad={true}
                thumbnailUrl={thumbnailUrl}
                onLoadedData={handleVideoLoad}
              />
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg group-hover:animate-subtle-pulse">
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </div>
            </div>
            {lora.lora_type && (
              <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm shadow-lg">
                  {lora.lora_type}
                </Badge>
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
          <h3 className="font-medium text-sm truncate flex-1 group-hover:text-primary transition-colors">{lora.name}</h3>
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
      
      {isAdmin && !isOwnProfile && (
         <CardFooter className="p-3 border-t bg-red-50 dark:bg-red-900/20" onClick={(e) => e.stopPropagation()}>
             <AlertDialog>
               <AlertDialogTrigger asChild>
                 <Button 
                   variant="destructive" 
                   size="sm" 
                   className="text-xs h-8 w-full"
                   disabled={isDeleting}
                 >
                   <Trash className="h-3 w-3 mr-1" /> 
                   Admin Delete
                 </Button>
               </AlertDialogTrigger>
               <AlertDialogContent>
                 <AlertDialogHeader>
                   <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                   <AlertDialogDescription>
                     This will permanently delete this LoRA and all its associated data. This is an admin action.
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                   <AlertDialogCancel>Cancel</AlertDialogCancel>
                   <AlertDialogAction 
                     onClick={handleDelete}
                     className="bg-destructive text-destructive-foreground"
                   >
                     Delete
                   </AlertDialogAction>
                 </AlertDialogFooter>
               </AlertDialogContent>
             </AlertDialog>
         </CardFooter>
      )}
    </Card>
  );
};

export default LoraCard;
