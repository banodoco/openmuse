import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { X, Pencil, Save, XCircle, Trash, List, ListChecks, Flame, EyeOff, Loader2 } from 'lucide-react';
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { VideoDisplayStatus, AdminStatus } from '@/lib/types';
import VideoStatusControls from '@/components/video/VideoStatusControls';
import { useAuth } from '@/hooks/useAuth';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface VideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoId: string;
  title?: string;
  description?: string;
  initialAssetId?: string;
  creator?: string | null;
  thumbnailUrl?: string;
  creatorId?: string;
  onVideoUpdate?: () => Promise<void> | void;
  isAuthorized?: boolean;
  currentStatus?: VideoDisplayStatus | null;
  onStatusChange?: (newStatus: VideoDisplayStatus) => Promise<void>;
  adminStatus?: AdminStatus | null;
  onAdminStatusChange?: (newStatus: AdminStatus) => Promise<void>;
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
  creatorId,
  onVideoUpdate,
  isAuthorized = false,
  currentStatus = null,
  onStatusChange,
  adminStatus = null,
  onAdminStatusChange
}) => {
  const { user, isAdmin } = useAuth();

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

  const canEdit = isAdmin || (user?.id && user.id === creatorId);
  const [isUpdatingAdminStatus, setIsUpdatingAdminStatus] = useState(false);

  const adminStatusIcons: Record<AdminStatus, React.ElementType> = {
    Listed: List,
    Curated: ListChecks,
    Featured: Flame,
    Hidden: EyeOff,
    Rejected: XCircle, // Keep for mapping, though button won't be shown
  };

  useEffect(() => {
    setEditableTitle(initialTitle || '');
    setEditableDescription(initialDescription || '');
    setEditableAssetId(initialAssetId || '');
    setIsEditing(false);
  }, [videoId, initialTitle, initialDescription, initialAssetId]);

  useEffect(() => {
    const fetchCreatorDisplayName = async () => {
      if (creatorId) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', creatorId)
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
  }, [creatorId, isOpen]);

  useEffect(() => {
    const fetchLoras = async () => {
      if (isOpen && canEdit && availableLoras.length === 0 && !isFetchingLoras) {
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
            
            // Filter out the specific LoRA ID
            const filteredLoras = formattedLoras.filter(lora => lora.id !== '3f7885ef-389d-4208-bf20-0e4df29388d2');
            
            setAvailableLoras(filteredLoras);
          } else {
            setAvailableLoras([]);
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
    if (!isEditing) { 
      setEditableTitle(initialTitle || '');
      setEditableDescription(initialDescription || '');
      setEditableAssetId(initialAssetId || '');
    } else {
    } 
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    if (!canEdit || !videoId) return;
    setIsSaving(true);

    const newAssetId = editableAssetId === "" ? null : editableAssetId;

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
        throw new Error(`Failed to update video details: ${mediaUpdateError.message}`);
      }

      // Step 2: Delete existing associations in asset_media for this video
      const { error: deleteError } = await supabase
        .from('asset_media')
        .delete()
        .eq('media_id', videoId);

      if (deleteError) {
        throw new Error(`Failed to clear existing LoRA associations: ${deleteError.message}`);
      }

      // Step 3: Insert new association if a LoRA was selected
      if (newAssetId) {
        const { error: insertError } = await supabase
          .from('asset_media')
          .insert({
            asset_id: newAssetId,
            media_id: videoId
          });

        if (insertError) {
          if (insertError.code === '23505') {
             throw new Error(`Failed to link LoRA: This video might already be linked to this LoRA. ${insertError.message}`);
          } else {
             throw new Error(`Failed to link selected LoRA: ${insertError.message}`);
          }
        }
      }

      // If all steps succeeded
      toast({
        title: "Video updated successfully!",
      });
      
      // Trigger potential refetch in parent component AND WAIT FOR IT
      if (onVideoUpdate) {
        await onVideoUpdate();
      }
      
      // Now exit edit mode *after* parent refetch (hopefully) completed
      setIsEditing(false); 
      
      // Close the lightbox after successful save and refetch
      onClose();

    } catch (error: any) {
      toast({
        title: "Error updating video",
        description: error.message || "Could not save changes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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

  const handleStatusInternal = async (newStatus: VideoDisplayStatus) => {
    if (onStatusChange) {
      try {
        await onStatusChange(newStatus);
        // Parent component is responsible for toast messages on success/local update
      } catch (error) {
        console.error("Error handling status change in lightbox:", error);
        toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      }
    } else {
        console.warn("VideoLightbox: onStatusChange prop is missing.");
    }
  };

  const handleAdminStatusInternal = async (newStatus: AdminStatus) => {
    if (onAdminStatusChange && isAdmin) {
      setIsUpdatingAdminStatus(true);
      try {
        await onAdminStatusChange(newStatus);
        // Parent should handle toast/state update
      } catch (error) {
        console.error("Error handling admin status change in lightbox:", error);
        toast({ title: "Error", description: "Failed to update admin status.", variant: "destructive" });
      } finally {
        setIsUpdatingAdminStatus(false);
      }
    } else {
        console.warn("VideoLightbox: onAdminStatusChange prop is missing or user is not admin.");
    }
  };

  return (
    <AlertDialog>
      <TooltipProvider delayDuration={100}>
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                if (isEditing) handleCancelEdit();
                onClose();
            }
        }}>
          <DialogContent className="max-w-5xl p-0 bg-background top-[5vh] h-[90vh] translate-y-0 [&>button.absolute.right-4.top-4]:hidden flex flex-col">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>
                {isEditing ? editableTitle : initialTitle || 'Video'}
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  {isEditing ? editableDescription : initialDescription || 'Video details and controls.'}
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            <div className="relative flex flex-col h-full">
              <button
                onClick={() => {
                    if (isEditing) handleCancelEdit();
                    onClose();
                }}
                className="absolute top-2 right-2 z-[60] bg-black/50 rounded-full p-2 text-white hover:bg-black/70 transition-all"
                aria-label="Close"
              >
                <X size={24} />
              </button>
              
              <div className={cn(
                "relative p-4 flex-shrink-0",
                "bg-white",
                isEditing ? "h-[40vh]" : "h-[75vh]"
              )}>
                <VideoPlayer
                  src={videoUrl}
                  poster={thumbnailUrl}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  autoPlay
                />

                {isAuthorized && currentStatus && onStatusChange && (
                  <div
                    className="absolute top-2 left-2 z-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    style={{ pointerEvents: 'all' }}
                  >
                    <VideoStatusControls
                      status={currentStatus}
                      onStatusChange={handleStatusInternal}
                      className=""
                    />
                  </div>
                )}

                {isAdmin && (
                  <div 
                    className="absolute top-14 left-2 z-50 flex flex-col items-start gap-1 bg-black/30 backdrop-blur-sm p-1.5 rounded-md"
                    style={{ pointerEvents: 'all' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <span className="text-xs font-medium text-white/80 px-1">Admin Status</span>
                    <div className="flex gap-1">
                      {(['Hidden', 'Listed', 'Curated', 'Featured'] as AdminStatus[]).map(status => {
                        const Icon = adminStatusIcons[status];
                        const isActive = adminStatus === status;
                        return (
                          <Tooltip key={status}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleAdminStatusInternal(status)}
                                disabled={isUpdatingAdminStatus}
                                className={cn(
                                  "h-7 w-7 rounded-sm",
                                  isActive 
                                    ? "bg-white/30 text-white ring-1 ring-white/50"
                                    : "bg-black/30 text-white/70 hover:bg-white/20 hover:text-white",
                                  isUpdatingAdminStatus && "animate-pulse"
                                )}
                              >
                                {isUpdatingAdminStatus && isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>{status}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 pt-0 flex-grow overflow-y-auto min-h-0">
                {isEditing ? (() => { 
                    const selectValue = editableAssetId || "";
                    return (
                      <div className="space-y-3">
                        <div>
                            <label htmlFor="videoTitle" className="text-sm font-medium text-muted-foreground">Title</label>
                            <Input
                                id="videoTitle"
                                value={editableTitle}
                                onChange={(e) => setEditableTitle(e.target.value)}
                                placeholder="Video Title"
                                disabled={isSaving}
                            />
                        </div>
                         <div>
                            <label htmlFor="videoDesc" className="text-sm font-medium text-muted-foreground">Description</label>
                            <Textarea
                                id="videoDesc"
                                value={editableDescription}
                                onChange={(e) => setEditableDescription(e.target.value)}
                                placeholder="Video Description"
                                rows={3}
                                disabled={isSaving}
                            />
                        </div>
                         <div>
                           <Label htmlFor="videoLora" className="text-sm font-medium text-muted-foreground block mb-1.5">LoRA (Optional)</Label>
                           {isFetchingLoras ? (
                              <Skeleton className="h-10 w-full" />
                           ) : (
                             <Select
                               value={selectValue}
                               onValueChange={(value) => {
                                 setEditableAssetId(value === "__NONE__" ? "" : value);
                               }}
                               disabled={isSaving}
                               name="videoLora"
                             >
                               <SelectTrigger id="videoLora">
                                 <SelectValue placeholder="Select a LoRA..." />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="__NONE__">-- None --</SelectItem>
                                 {availableLoras.map((lora) => (
                                   <SelectItem key={lora.id} value={lora.id}>
                                     {lora.name}
                                   </SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           )}
                         </div>
                        <div className="flex justify-end space-x-2 pt-2">
                           <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                               <XCircle className="mr-2 h-4 w-4" /> Cancel
                           </Button>
                           <Button
                              onClick={(e) => {
                                  handleSaveEdit();
                              }}
                              disabled={isSaving}
                           >
                               <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
                           </Button>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="space-y-2">
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
                      {displayCreator && (
                         <p className="text-sm text-muted-foreground">{displayCreator}</p>
                      )}
                      {initialDescription && (
                          <p className="text-sm mt-2 whitespace-pre-wrap">{initialDescription}</p>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </AlertDialog>
  );
};

export default VideoLightbox;
