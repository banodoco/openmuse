import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { X, Pencil, Save, XCircle, Trash, List, ListChecks, Flame, EyeOff, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import VideoPlayer from '@/components/video/VideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import LoraCreatorInfo from './lora/LoraCreatorInfo';
import { Link, useSearchParams } from 'react-router-dom';
import { useLoras } from '@/contexts/LoraContext';

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
  /** If true, shows a button to navigate to the previous video and fires the callback when clicked */
  hasPrev?: boolean;
  onPrevVideo?: () => void;
  /** If true, shows a button to navigate to the next video and fires the callback when clicked */
  hasNext?: boolean;
  onNextVideo?: () => void;
  classification?: 'art' | 'gen';
  /** Callback function to handle video deletion. If provided, a delete button will be shown if authorized. */
  onDeleteVideo?: (videoId: string) => Promise<void>;
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
  onAdminStatusChange,
  hasPrev,
  onPrevVideo,
  hasNext,
  onNextVideo,
  classification: initialClassification = 'gen',
  onDeleteVideo
}) => {
  const { user, isAdmin } = useAuth();
  const { loras: availableLoras, isLoading: isFetchingLoras, error: loraFetchError } = useLoras();

  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();

  const [isEditing, setIsEditing] = useState(false);
  const [editableTitle, setEditableTitle] = useState(initialTitle || '');
  const [editableDescription, setEditableDescription] = useState(initialDescription || '');
  const [editableAssetId, setEditableAssetId] = useState(initialAssetId || '');
  const [editableClassification, setEditableClassification] = useState<'art' | 'gen'>(initialClassification);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingAdminStatus, setIsUpdatingAdminStatus] = useState(false);

  // State for thumbnail editing
  const [newThumbnailFile, setNewThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);

  const canEdit = isAdmin || (user?.id && user.id === creatorId);

  const adminStatusIcons: Record<AdminStatus, React.ElementType> = {
    Listed: List,
    Curated: ListChecks,
    Featured: Flame,
    Hidden: EyeOff,
    Rejected: XCircle, // Keep for mapping, though button won't be shown
  };

  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    setEditableTitle(initialTitle || '');
    setEditableDescription(initialDescription || '');
    setEditableAssetId(initialAssetId || '');
    setEditableClassification(initialClassification);
    // Reset thumbnail state when videoId changes
    setNewThumbnailFile(null);
    if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    setThumbnailPreviewUrl(null);
    const fileInput = document.getElementById('videoThumbnail') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, [videoId, initialTitle, initialDescription, initialAssetId, initialClassification]); // Removed thumbnailPreviewUrl from deps here as it's reset

  useEffect(() => {
    if (loraFetchError) {
      toast({
        title: "Could not load LoRAs",
        description: loraFetchError || "Failed to fetch LoRA list for selection.",
        variant: "destructive",
      });
    }
  }, [loraFetchError, toast]);

  // --------------------------------------------------
  // Keep ?video=<id> in the URL while the lightbox is open.
  // --------------------------------------------------
  // 1. Whenever `videoId` changes _and_ the lightbox is open → write param.
  useEffect(() => {
    if (!isOpen) return;
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('video', videoId);
      return p;
    }, { replace: true });
  }, [videoId, isOpen, setSearchParams]);

  // 2. When the lightbox is closed/unmounted → remove the param once.
  useEffect(() => {
    if (!isOpen) return;
    return () => {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.delete('video');
        return p;
      }, { replace: true });
    };
  }, [isOpen, setSearchParams]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditableTitle(initialTitle || '');
    setEditableDescription(initialDescription || '');
    setEditableAssetId(initialAssetId || '');
    setEditableClassification(initialClassification);
    // Reset thumbnail state
    setNewThumbnailFile(null);
    if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
    }
    setThumbnailPreviewUrl(null);
    const fileInput = document.getElementById('videoThumbnail') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
  }, [initialTitle, initialDescription, initialAssetId, initialClassification, thumbnailPreviewUrl]); // Keep thumbnailPreviewUrl dependency here for cleanup

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

  // New useEffect to update classification when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditableClassification(initialClassification);
    }
  }, [isEditing, initialClassification]);

  const handleToggleEdit = () => {
    if (!isEditing) { 
      setEditableTitle(initialTitle || '');
      setEditableDescription(initialDescription || '');
      setEditableAssetId(initialAssetId || '');
      setEditableClassification(initialClassification);
    } else {
      // No action needed when exiting edit mode here
    } 
    setIsEditing(!isEditing);
  };

  // Handler for thumbnail file input change
  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewThumbnailFile(file);
      // Clean up previous preview URL if exists before creating a new one
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
      const newPreviewUrl = URL.createObjectURL(file);
      setThumbnailPreviewUrl(newPreviewUrl);
    } else {
      // No file selected or selection cancelled
      setNewThumbnailFile(null);
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
      setThumbnailPreviewUrl(null);
    }
  };

  // Handler to clear thumbnail selection
  const handleClearThumbnailSelection = () => {
      setNewThumbnailFile(null);
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
      setThumbnailPreviewUrl(null);
      // Reset file input visually
      const fileInput = document.getElementById('videoThumbnail') as HTMLInputElement;
      if (fileInput) {
          fileInput.value = '';
      }
  };

  const handleSaveEdit = async () => {
    if (!canEdit || !videoId) return;
    setIsSaving(true);

    const newAssetId = editableAssetId === "" ? null : editableAssetId;
    let newThumbnailUrl: string | undefined | null = undefined; // undefined means no change

    try {
      // Step 0: Upload new thumbnail if selected
      if (newThumbnailFile) {
        console.log("Attempting to upload new thumbnail:", newThumbnailFile.name);
        const fileExt = newThumbnailFile.name.split('.').pop();
        const uniqueFileName = `${Date.now()}.${fileExt}`;
        // Use a consistent bucket name, e.g., 'media_thumbnails'
        const filePath = `public/${videoId}/${uniqueFileName}`; // Store under videoId folder in public dir

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media_thumbnails') // Ensure this bucket exists and has correct policies
          .upload(filePath, newThumbnailFile, {
            cacheControl: '3600', // Cache for 1 hour
            upsert: false // Don't overwrite if somehow the exact same name exists
          });

        if (uploadError) {
          console.error("Thumbnail upload error:", uploadError);
          throw new Error(`Failed to upload thumbnail: ${uploadError.message}. Check bucket policies and existence.`);
        }
        console.log("Thumbnail uploaded:", uploadData);


        // Get the public URL using the correct bucket name
        const { data: urlData } = supabase.storage
          .from('media_thumbnails')
          .getPublicUrl(filePath);

        console.log("Public URL data:", urlData);


        if (!urlData?.publicUrl) {
            console.error("Error getting public URL after upload");
            // Attempt to construct URL manually as fallback (less ideal)
            // const manualUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media_thumbnails/${filePath}`;
            // console.warn("Falling back to manually constructed URL:", manualUrl);
            // newThumbnailUrl = manualUrl;
            throw new Error("Failed to get thumbnail public URL after upload. Check if the object is public.");
        } else {
            newThumbnailUrl = urlData.publicUrl;
            console.log("New thumbnail URL:", newThumbnailUrl);
        }
      }

      // Step 1: Prepare update payload for 'media' table
      const mediaUpdatePayload: {
        title: string;
        description: string;
        classification: 'art' | 'gen';
        placeholder_image?: string | null; // Include conditionally
      } = {
        title: editableTitle,
        description: editableDescription,
        classification: editableClassification,
      };

      // Only add placeholder_image to payload if a new one was successfully uploaded
      if (newThumbnailUrl !== undefined) {
          mediaUpdatePayload.placeholder_image = newThumbnailUrl;
      }

      // Step 2: Update media title, description, classification, and potentially placeholder_image
      console.log("Updating media table with payload:", mediaUpdatePayload);
      const { error: mediaUpdateError } = await supabase
        .from('media')
        .update(mediaUpdatePayload)
        .eq('id', videoId);

      if (mediaUpdateError) {
        console.error("Media update error:", mediaUpdateError);
        throw new Error(`Failed to update video details: ${mediaUpdateError.message}`);
      }
      console.log("Media table updated successfully.");


      // Step 3: Delete existing associations in asset_media for this video
      console.log("Deleting existing LoRA associations for media_id:", videoId);
      const { error: deleteError } = await supabase
        .from('asset_media')
        .delete()
        .eq('media_id', videoId);

      if (deleteError) {
        console.error("LoRA association deletion error:", deleteError);
        throw new Error(`Failed to clear existing LoRA associations: ${deleteError.message}`);
      }
      console.log("Existing LoRA associations deleted.");


      // Step 4: Insert new association if a LoRA was selected
      if (newAssetId) {
        console.log("Inserting new LoRA association:", { asset_id: newAssetId, media_id: videoId });
        const { error: insertError } = await supabase
          .from('asset_media')
          .insert({
            asset_id: newAssetId,
            media_id: videoId
          });

        if (insertError) {
          console.error("LoRA association insertion error:", insertError);
          if (insertError.code === '23505') { // Unique violation
              throw new Error(`Failed to link LoRA: This video might already be linked to this LoRA. ${insertError.message}`);
          } else {
              throw new Error(`Failed to link selected LoRA: ${insertError.message}`);
          }
        }
        console.log("New LoRA association inserted.");
      } else {
        console.log("No LoRA selected, skipping association insert.");
      }

      // If all steps succeeded
      toast({
        title: "Video updated successfully!",
      });

      // Close the lightbox immediately
      onClose();

      // Exit edit mode (component will unmount shortly after onClose)
      setIsEditing(false);

      // Reset file state after successful save & close
      setNewThumbnailFile(null);
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
      setThumbnailPreviewUrl(null);

      // Trigger potential refetch in parent component WITHOUT blocking UI
      if (onVideoUpdate) {
        console.log("Calling onVideoUpdate callback.");
        // Run async without await
        Promise.resolve(onVideoUpdate()).catch(err => console.error("Error in onVideoUpdate callback:", err));
      }

    } catch (error: any) {
      console.error('[VideoLightboxDebug] Save error:', error);
      toast({
        title: "Failed to save changes",
        description: error.message || "An error occurred while saving your changes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      console.log("Save operation finished.");
    }
  };

  const displayTitle = isEditing ? '' : (initialTitle || '');

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

   // Cleanup preview URL on unmount or when preview URL changes
   useEffect(() => {
    // This function will be called when the component unmounts
    // or when thumbnailPreviewUrl changes before the effect runs again.
    const currentPreviewUrl = thumbnailPreviewUrl; // Capture the value
    return () => {
        if (currentPreviewUrl) {
            URL.revokeObjectURL(currentPreviewUrl);
            console.log("Revoked blob URL:", currentPreviewUrl);
        }
    };
  }, [thumbnailPreviewUrl]); // Depend only on thumbnailPreviewUrl

  return (
    <AlertDialog>
      <TooltipProvider delayDuration={100}>
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              // Remove ?video param immediately so parent pages don't auto-reopen
              setSearchParams(prev => {
                const p = new URLSearchParams(prev);
                p.delete('video');
                return p;
              }, { replace: true });

              if (isEditing) handleCancelEdit();
              onClose();
            }
          }}
        >
          <DialogContent
            className="max-w-5xl p-0 bg-background max-h-[90vh] flex flex-col"
            onClickCapture={(e) => {
              const anchor = (e.target as HTMLElement).closest('a');
              if (anchor) {
                // Clear param then close lightbox so navigation proceeds cleanly
                setSearchParams(prev => {
                  const p = new URLSearchParams(prev);
                  p.delete('video');
                  return p;
                }, { replace: true });
                onClose();
              }
            }}
          >
            <DialogHeader className="p-4 border-b">
              <DialogTitle>
                {isEditing ? 'Edit Video Details' : initialTitle || 'Video'}
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  {isEditing ? editableDescription : initialDescription || 'Video details and controls.'}
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            <div className="relative flex flex-col h-full">
              <div className={cn(
                "relative w-full aspect-video bg-black transition-[max-height] duration-300 ease-in-out",
                isEditing && isMobile ? "hidden" :
                isEditing && !isMobile ? "max-h-[25vh] flex-shrink mb-4" :
                "max-h-[65vh] flex-shrink-0"
              )}>
                <VideoPlayer
                  src={videoUrl}
                  poster={thumbnailUrl}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  autoPlay={true}
                  muted={false}
                  isMobile={isMobile}
                  externallyControlled={isMobile}
                  isHovering={isMobile}
                  lazyLoad={false}
                />

                {/* Desktop Navigation Buttons */}
                {!isMobile && hasPrev && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (onPrevVideo) onPrevVideo();
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-50 h-10 w-10 bg-black/40 hover:bg-black/60 text-white"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                )}
                {!isMobile && hasNext && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (onNextVideo) onNextVideo();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-50 h-10 w-10 bg-black/40 hover:bg-black/60 text-white"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                )}

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
              
              {/* Mobile Navigation Buttons placed below the video container */}
              {isMobile && (hasPrev || hasNext) && (
                <div className="flex justify-center items-center space-x-4 mt-4">
                  {hasPrev && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (onPrevVideo) onPrevVideo();
                      }}
                      className="h-10 w-10 bg-black/40 hover:bg-black/60 text-white"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                  )}
                  {hasNext && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (onNextVideo) onNextVideo();
                      }}
                      className="h-10 w-10 bg-black/40 hover:bg-black/60 text-white"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  )}
                </div>
              )}

              <div className="p-4 pt-0 flex-grow overflow-y-auto min-h-0">
                {isEditing ? (() => {
                    const selectValue = editableAssetId || "";
                    // Use grid for layout: 1 col mobile, 2 cols desktop
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {/* Left Column: Text fields & Select */}
                        <div className="space-y-4 order-2 md:order-1">
                          <div>
                            <Label htmlFor="videoTitle" className="text-sm font-medium text-muted-foreground block mb-1.5">Title</Label>
                            <Input
                              id="videoTitle"
                              value={editableTitle}
                              onChange={(e) => setEditableTitle(e.target.value)}
                              placeholder="Enter a title..."
                              disabled={isSaving}
                            />
                          </div>

                          <div>
                            <Label htmlFor="videoDescription" className="text-sm font-medium text-muted-foreground block mb-1.5">Description</Label>
                            <Textarea
                              id="videoDescription"
                              value={editableDescription}
                              onChange={(e) => setEditableDescription(e.target.value)}
                              placeholder="Enter a description..."
                              disabled={isSaving}
                              rows={isMobile ? 3 : 4} // Adjust rows based on screen
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-muted-foreground block mb-1.5">Classification</Label>
                            <RadioGroup
                              value={editableClassification}
                              onValueChange={(value) => setEditableClassification(value as 'art' | 'gen')}
                              className="flex gap-4"
                              disabled={isSaving}
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="gen" id="classification-gen" />
                                <Label htmlFor="classification-gen">Generation</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="art" id="classification-art" />
                                <Label htmlFor="classification-art">Art</Label>
                              </div>
                            </RadioGroup>
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
                                disabled={isSaving || isFetchingLoras}
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
                            {loraFetchError && (
                              <p className="text-sm text-destructive mt-1.5">Error loading LoRAs. Please try again later.</p>
                            )}
                          </div>
                        </div>

                        {/* Right Column: Thumbnail Edit */}
                        <div className="space-y-2 order-1 md:order-2">
                           <Label htmlFor="videoThumbnail" className="text-sm font-medium text-muted-foreground block mb-1.5">Thumbnail</Label>
                           {/* Thumbnail Preview */}
                           <div className="aspect-video w-full bg-muted rounded overflow-hidden mb-2 relative group">
                             <img
                               key={thumbnailPreviewUrl || thumbnailUrl || 'empty'} // Force re-render on src change
                               src={thumbnailPreviewUrl || thumbnailUrl || ''}
                               alt="Thumbnail preview"
                               className="w-full h-full object-cover text-transparent" // text-transparent hides alt text if image fails
                               // Basic error handling: show a placeholder icon or hide? Let's hide.
                               onError={(e) => {
                                 e.currentTarget.style.opacity = '0'; // Hide broken image icon visually
                                 const parent = e.currentTarget.parentElement;
                                 if (parent && !parent.querySelector('.placeholder-icon')) {
                                      // Optionally add a placeholder SVG or text here if needed
                                 }
                               }}
                               onLoad={(e) => { e.currentTarget.style.opacity = '1'; }} // Ensure visible on load
                             />
                             {!(thumbnailPreviewUrl || thumbnailUrl) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 placeholder-icon">
                                  <span className="text-xs text-muted-foreground">No Thumbnail</span>
                                </div>
                             )}
                           </div>
                           {/* File Input */}
                           <Input
                             id="videoThumbnail"
                             type="file"
                             accept="image/*" // Accept common image types
                             onChange={handleThumbnailChange}
                             disabled={isSaving}
                             className="text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                           />
                           {/* Clear selection button */}
                           {newThumbnailFile && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearThumbnailSelection}
                                disabled={isSaving}
                                className="text-xs text-muted-foreground h-auto py-1 px-2 mt-1"
                              >
                                Clear selection
                              </Button>
                           )}
                        </div>

                        {/* Save/Cancel Buttons (spanning both columns) */}
                        <div className="md:col-span-2 flex justify-end gap-2 pt-2 order-3">
                           <Button
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveEdit}
                            disabled={isSaving || (!editableTitle && !newThumbnailFile)} // Basic validation example
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })() : (
                     // View mode details (unchanged structure)
                     <div className="space-y-2">
                       <div className="flex items-center justify-between gap-2 mb-4">
                         <div className="flex-1" />
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
                               {isAuthorized && onDeleteVideo && (
                                 <AlertDialog>
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <AlertDialogTrigger asChild>
                                         <Button
                                           variant="destructive"
                                           size="icon"
                                           className="relative"
                                           disabled={isDeleting}
                                         >
                                           {isDeleting ? (
                                             <Loader2 className="h-4 w-4 animate-spin absolute" />
                                           ) : (
                                             <Trash className="h-4 w-4" />
                                           )}
                                           <VisuallyHidden>Delete Video</VisuallyHidden>
                                         </Button>
                                       </AlertDialogTrigger>
                                     </TooltipTrigger>
                                     <TooltipContent side="bottom">Delete Video</TooltipContent>
                                   </Tooltip>
                                   <AlertDialogContent>
                                     <AlertDialogHeader>
                                       <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                     </AlertDialogHeader>
                                     <AlertDialogFooter>
                                       <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                       <AlertDialogAction
                                         onClick={async (e) => {
                                           e.preventDefault();
                                           if (!onDeleteVideo) return;
                                           setIsDeleting(true);
                                           try {
                                             await onDeleteVideo(videoId);
                                             toast({ title: "Video deleted successfully." });
                                             onClose();
                                           } catch (error: any) {
                                             console.error("Error deleting video:", error);
                                             toast({
                                               title: "Deletion Failed",
                                               description: error?.message || "Could not delete the video.",
                                               variant: "destructive",
                                             });
                                           } finally {
                                             setIsDeleting(false);
                                           }
                                         }}
                                         disabled={isDeleting}
                                         className={cn(
                                           "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                                           isDeleting && "opacity-50 cursor-not-allowed"
                                         )}
                                       >
                                         {isDeleting ? "Deleting..." : "Delete"}
                                       </AlertDialogAction>
                                     </AlertDialogFooter>
                                   </AlertDialogContent>
                                 </AlertDialog>
                               )}
                           </div>
                         )}
                       </div>
                       {creatorId && (
                         <div className="mt-1.5">
                           <LoraCreatorInfo 
                             asset={{ user_id: creatorId } as any} 
                             avatarSize="h-5 w-5"
                             textSize="text-sm" 
                           />
                         </div>
                       )}
                       {initialDescription && (
                           <p className="text-sm mt-2 whitespace-pre-wrap">{initialDescription}</p>
                       )}
                       {initialAssetId && (() => {
                         const loraName = availableLoras.find(l => l.id === initialAssetId)?.name;
                         if (!loraName) return null; // Don't render if name not found (yet)
                         return (
                           <p className="text-sm mt-3 text-muted-foreground">
                             Made with{' '}
                             <Link
                               to={`/assets/${encodeURIComponent(initialAssetId)}`}
                               className="text-foreground underline"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 // Clear URL param and close before navigating
                                 setSearchParams(prev => {
                                   const p = new URLSearchParams(prev);
                                   p.delete('video');
                                   return p;
                                 }, { replace: true });
                                 onClose();
                               }}
                             >
                               {loraName}
                             </Link>
                           </p>
                         );
                       })()}
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
