import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Pencil, Save, XCircle, Trash, ArrowLeft, ArrowRight, Link as LinkIcon, User, Tag, FolderTree } from 'lucide-react';
import VideoPlayer from '@/components/video/VideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { AuthContext } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
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
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { LoraAsset } from '@/lib/types';
import { Logger } from '@/lib/logger';
import { Link } from 'react-router-dom';
import AssetAssociation from './AssetAssociation';
import VideoDetailsEditor from './VideoDetailsEditor';
import { ScrollArea } from "@/components/ui/scroll-area";
import VideoStatusControls from './video/VideoStatusControls';
import { VideoDisplayStatus } from '@/lib/types';

const logger = new Logger('VideoLightbox');

interface VideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string | null;
  videoId: string | null;
  title?: string;
  description?: string;
  initialAssetId?: string;
  creator?: string;
  thumbnailUrl?: string | null;
  creatorId?: string | null;
  onVideoUpdate?: () => void;
  currentStatus?: VideoDisplayStatus | null;
  onStatusChange?: (newStatus: VideoDisplayStatus) => Promise<void>;
  isAuthorized?: boolean;
}

interface LoraOption {
  id: string;
  name: string;
}

const VideoLightbox: React.FC<VideoLightboxProps> = ({
  isOpen,
  onClose,
  videoUrl,
  videoId,
  title: initialTitle,
  description: initialDescription,
  initialAssetId,
  creator,
  thumbnailUrl,
  creatorId: explicitCreatorId,
  onVideoUpdate,
  currentStatus,
  onStatusChange,
  isAuthorized = false,
}) => {
  console.log('[VideoLightboxDebug] Component Rendered. Initial videoId prop:', videoId);
  console.log('[VideoLightboxDebug] Component Version: 2024-07-30_10:00'); // Updated version log

  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const isAdmin = authContext?.isAdmin ?? false;

  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const [isEditing, setIsEditing] = useState(false);
  const [editableTitle, setEditableTitle] = useState(initialTitle || '');
  const [editableDescription, setEditableDescription] = useState(initialDescription || '');
  const [editableAssetId, setEditableAssetId] = useState(initialAssetId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [availableLoras, setAvailableLoras] = useState<LoraOption[]>([]);
  const [isFetchingLoras, setIsFetchingLoras] = useState(false);

  const { isOwner } = useAuth();
  const canEdit = isOwner || isAdmin;

  useEffect(() => {
    setEditableTitle(initialTitle || '');
    setEditableDescription(initialDescription || '');
    setEditableAssetId(initialAssetId || '');
    setIsEditing(false);
  }, [videoId, initialTitle, initialDescription, initialAssetId]);

  useEffect(() => {
    const fetchCreatorDisplayName = async () => {
      if (explicitCreatorId) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', explicitCreatorId)
            .maybeSingle();
          
          if (profile && !error) {
            setCreatorDisplayName(profile.display_name || profile.username);
          }
        } catch (error) {
          console.error('Error fetching creator profile:', error);
        }
      }
    };

    if (isOpen) {
      fetchCreatorDisplayName();
    }
  }, [explicitCreatorId, isOpen]);

  useEffect(() => {
    const fetchLoras = async () => {
      if (isOpen && canEdit && availableLoras.length === 0 && !isFetchingLoras) {
        console.log('[VideoLightboxDebug] Starting LoRA fetch...');
        setIsFetchingLoras(true);
        try {
          const { data, error } = await supabase
            .from('assets')
            .select('id, name')
            .eq('type', 'LoRA')
            .order('name', { ascending: true });

          if (error) {
             console.error("Supabase error fetching LoRAs:", error);
             throw new Error(error.message);
          }

          if (data) {
            const formattedLoras: LoraOption[] = data.map((item: any) => ({
              id: item.id,
              name: item.name
            }));
            setAvailableLoras(formattedLoras);
            console.log('[VideoLightboxDebug] LoRA fetch success:', formattedLoras);
          } else {
            setAvailableLoras([]);
            console.log('[VideoLightboxDebug] LoRA fetch success: No LoRAs found.');
          }
        } catch (error: any) {
          console.error('[VideoLightboxDebug] LoRA fetch error:', error);
          toast({
            title: "Could not load LoRAs",
            description: error.message || "Failed to fetch LoRA list for selection.",
            variant: "destructive",
          });
          setAvailableLoras([]);
        } finally {
          setIsFetchingLoras(false);
        }
      }
    };

    fetchLoras();
  }, [isOpen, canEdit, availableLoras.length, isFetchingLoras, toast]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditableTitle(initialTitle || '');
    setEditableDescription(initialDescription || '');
    setEditableAssetId(initialAssetId || '');
  }, [initialTitle, initialDescription, initialAssetId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          handleCancelEdit();
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, isEditing, handleCancelEdit]);

  const handleToggleEdit = () => {
    console.log(`[VideoLightboxDebug] handleToggleEdit called. Current isEditing: ${isEditing}`);
    if (!isEditing) { 
      console.log(`[VideoLightboxDebug] Entering edit mode. Initial Asset ID from props: '${initialAssetId}'`);
      setEditableTitle(initialTitle || '');
      setEditableDescription(initialDescription || '');
      setEditableAssetId(initialAssetId || '');
      console.log(`[VideoLightboxDebug] Set editableAssetId state to: '${initialAssetId || ''}'`);
    } else {
      console.log('[VideoLightboxDebug] Leaving edit mode.');
    } 
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    console.log('[VideoLightboxDebug] handleSaveEdit: videoId *before* check:', videoId);
    console.log(`[VideoLightboxDebug] Checking save conditions: canEdit=${canEdit}, videoId=${videoId}`);
    if (!canEdit || !videoId) return;
    setIsSaving(true);
    console.log('[VideoLightboxDebug] handleSaveEdit: Starting save process...');

    const newAssetId = editableAssetId === "" ? null : editableAssetId;
    console.log('[VideoLightboxDebug] handleSaveEdit: Target asset ID:', newAssetId);

    try {
      // Step 1: Update media title and description
      const { error: mediaUpdateError } = await supabase
        .from('media')
        .update({
          title: editableTitle,
          description: editableDescription
        })
        .eq('id', videoId);

      if (mediaUpdateError) {
        console.error('[VideoLightboxDebug] handleSaveEdit: Error updating media details:', mediaUpdateError);
        throw new Error(`Failed to update video details: ${mediaUpdateError.message}`);
      }
      console.log('[VideoLightboxDebug] handleSaveEdit: Media details updated successfully.');

      // Step 2: Delete existing associations in asset_media for this video
      const { error: deleteError } = await supabase
        .from('asset_media')
        .delete()
        .eq('media_id', videoId);

      if (deleteError) {
        // Log the error but maybe proceed? Or should this be fatal? For now, let's make it fatal.
        console.error('[VideoLightboxDebug] handleSaveEdit: Error deleting existing asset_media links:', deleteError);
        throw new Error(`Failed to clear existing LoRA associations: ${deleteError.message}`);
      }
       console.log('[VideoLightboxDebug] handleSaveEdit: Existing asset_media links cleared successfully.');


      // Step 3: Insert new association if a LoRA was selected
      if (newAssetId) {
        console.log(`[VideoLightboxDebug] handleSaveEdit: Attempting to insert new asset_media link: mediaId=${videoId}, assetId=${newAssetId}`);
        const { error: insertError } = await supabase
          .from('asset_media')
          .insert({
            asset_id: newAssetId,
            media_id: videoId
          });

        if (insertError) {
          console.error('[VideoLightboxDebug] handleSaveEdit: Error inserting new asset_media link:', insertError);
          // Check for unique constraint violation (e.g., 23505 in PostgreSQL) which might indicate a race condition or logic error
          if (insertError.code === '23505') {
             throw new Error(`Failed to link LoRA: This video might already be linked to this LoRA. ${insertError.message}`);
          } else {
             throw new Error(`Failed to link selected LoRA: ${insertError.message}`);
          }
        }
         console.log('[VideoLightboxDebug] handleSaveEdit: New asset_media link inserted successfully.');
      } else {
         console.log('[VideoLightboxDebug] handleSaveEdit: No new LoRA selected, skipping insert into asset_media.');
      }

      // If all steps succeeded
      toast({
        title: "Video updated successfully!",
      });
      console.log('[VideoLightboxDebug] handleSaveEdit: Update successful, toast shown.');
      
      // Trigger potential refetch in parent component AND WAIT FOR IT
      if (onVideoUpdate) {
        console.log('[VideoLightboxDebug] handleSaveEdit: Calling and awaiting onVideoUpdate...');
        await onVideoUpdate();
        console.log('[VideoLightboxDebug] handleSaveEdit: onVideoUpdate completed.');
      }
      
      // Now exit edit mode *after* parent refetch (hopefully) completed
      setIsEditing(false); 
      
      // Close the lightbox after successful save and refetch
      onClose();

    } catch (error: any) {
      console.error('[VideoLightboxDebug] handleSaveEdit: Error during update process:', error);
      toast({
        title: "Error updating video",
        description: error.message || "Could not save changes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      console.log('[VideoLightboxDebug] handleSaveEdit: Finished save process (finally block).');
    }
  };

  const handleDeleteVideo = async () => {
    if (!canEdit || !videoId) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      toast({
        title: "Video deleted successfully!",
      });
      onClose();
      if (onVideoUpdate) {
        onVideoUpdate();
      }

    } catch (error: any) {
      console.error("Error deleting video:", error);
      toast({
        title: "Error deleting video",
        description: error.message || "Could not delete the video.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const displayTitle = isEditing ? '' : (initialTitle || '');
  const displayCreator = creatorDisplayName ? `By ${creatorDisplayName}` : '';

  const loraDisplayText = initialAssetId
    ? availableLoras.find(l => l.id === initialAssetId)?.name ?? initialAssetId
    : null;

  const handleSaveDetails = (newTitle: string, newDescription: string | null) => {
    setEditableTitle(newTitle);
    setEditableDescription(newDescription);
    if (onVideoUpdate) {
      onVideoUpdate(); // Trigger parent refresh if needed
    }
  };

  const handleAssetChange = (newAssetId: string | null) => {
    // Refetch asset details if needed, or trigger parent refresh
    fetchAssetDetails(newAssetId);
    if (onVideoUpdate) {
      onVideoUpdate();
    }
  };

  return (
    <AlertDialog>
      <Dialog open={isOpen} onOpenChange={(open) => {
          if (!open) {
              if (isEditing) handleCancelEdit();
              onClose();
          }
      }}>
        <DialogContent 
          className="max-w-6xl w-full h-[90vh] p-0 flex flex-col md:flex-row gap-0 !rounded-lg overflow-hidden glass-darker"
          onInteractOutside={(e) => {
            // Prevent closing if clicking inside the editor/association components
            const target = e.target as HTMLElement;
            if (target.closest('[data-no-dismiss]')) {
              e.preventDefault();
            }
          }}
        >
          {/* Video Player Section */}
          <div className="flex-grow h-1/2 md:h-full md:w-3/4 relative bg-black flex items-center justify-center">
            {videoUrl ? (
              <video
                ref={videoRef}
                key={videoId} // Force re-render if video changes
                src={videoUrl}
                controls
                autoPlay
                muted // Start muted to avoid autoplay issues
                loop
                playsInline // Important for mobile
                className="max-w-full max-h-full object-contain"
                poster={thumbnailUrl || undefined}
              />
            ) : (
              <div className="text-white">Loading video...</div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-50"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </Button>
            
            {/* --- Add Status Controls --- */}
            {isAuthorized && currentStatus !== null && onStatusChange && (
               <div 
                 className="absolute top-4 left-4 z-50" 
                 onClick={(e) => e.stopPropagation()} // Prevent click from propagating to video/dialog
                 data-no-dismiss // Prevent closing dialog when interacting with controls
               >
                 <VideoStatusControls
                   status={currentStatus}
                   onStatusChange={onStatusChange} // Pass the pre-bound handler
                   className="bg-black/50 backdrop-blur-sm" // Add some styling for visibility
                 />
               </div>
             )}
             {/* --- End Status Controls --- */}

          </div>

          {/* Details Sidebar */}
          <ScrollArea className="w-full md:w-1/4 h-1/2 md:h-full bg-background/80 backdrop-blur-md text-foreground border-l border-border/20 flex flex-col">
            <div className="p-4 flex flex-col h-full">
              <div className="flex items-center justify-between gap-2">
                {displayTitle ? (
                  <h2 className="text-xl font-semibold truncate flex-1">
                     {displayTitle}
                  </h2>
                ) : (
                  <div className="flex-1" />
                )}
                {canEdit && (
                  <div className="flex items-center space-x-1 flex-shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { 
                          e.stopPropagation(); // Prevent event bubbling
                          handleToggleEdit(); 
                        }} 
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                         <Pencil size={16} />
                         <span className="sr-only">Edit</span>
                      </Button>
                      <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                             <Trash size={16} />
                             <span className="sr-only">Delete</span>
                          </Button>
                       </AlertDialogTrigger>
                  </div>
                )}
              </div>
              {initialDescription && <p className="text-sm text-muted-foreground mt-1">{initialDescription}</p>}
              {loraDisplayText && (
                <p className="text-xs text-muted-foreground italic mt-1">
                  LoRA: {loraDisplayText}
                </p>
              )}
              <div className="text-sm text-muted-foreground">{displayCreator}</div>
            </div>
          </ScrollArea>
        </DialogContent>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the video data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
                onClick={handleDeleteVideo}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
              {isDeleting ? 'Deleting...' : 'Yes, delete video'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </Dialog>
     </AlertDialog>
  );
};

export default VideoLightbox;
