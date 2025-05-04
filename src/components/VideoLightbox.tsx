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
import { Slider } from "@/components/ui/slider";
import { Camera } from 'lucide-react';

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
  thumbnailUrl: initialThumbnailUrl,
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
  const [isSelectingFrame, setIsSelectingFrame] = useState(false);
  const [isSavingThumbnail, setIsSavingThumbnail] = useState(false);

  // Thumbnail/Frame Selection State
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number>(0);
  const [framePreviewUrl, setFramePreviewUrl] = useState<string | null>(null);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);
  const [hasCapturedNewFrame, setHasCapturedNewFrame] = useState(false);

  const canEdit = isAdmin || (user?.id && user.id === creatorId);

  const adminStatusIcons: Record<AdminStatus, React.ElementType> = {
    Listed: List,
    Curated: ListChecks,
    Featured: Flame,
    Hidden: EyeOff,
    Rejected: XCircle, // Keep for mapping, though button won't be shown
  };

  const [, setSearchParams] = useSearchParams();

  // --- Refs ---
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setEditableTitle(initialTitle || '');
    setEditableDescription(initialDescription || '');
    setEditableAssetId(initialAssetId || '');
    setEditableClassification(initialClassification);
    setIsSelectingFrame(false);
    setVideoDuration(0);
    setSelectedTimestamp(0);
    setFramePreviewUrl(null);
    setHasCapturedNewFrame(false);
    setIsCapturingFrame(false);
  }, [videoId, initialTitle, initialDescription, initialAssetId, initialClassification, initialThumbnailUrl]);

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
    setIsSelectingFrame(false);
    setVideoDuration(0);
    setSelectedTimestamp(0);
    setFramePreviewUrl(null);
    setHasCapturedNewFrame(false);
    setIsCapturingFrame(false);
    if (lightboxVideoRef.current) {
      lightboxVideoRef.current.currentTime = 0;
    }
  }, [initialTitle, initialDescription, initialAssetId, initialClassification, lightboxVideoRef]);

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
      setSelectedTimestamp(0);
      setFramePreviewUrl(null);
      setHasCapturedNewFrame(false);
      setIsCapturingFrame(false);
      setIsSelectingFrame(false);
      if (lightboxVideoRef.current?.readyState >= 1) {
         setVideoDuration(lightboxVideoRef.current.duration || 0);
      }
    } else {
       if (lightboxVideoRef.current) lightboxVideoRef.current.currentTime = 0;
       setVideoDuration(0);
       setSelectedTimestamp(0);
       setFramePreviewUrl(null);
       setHasCapturedNewFrame(false);
    }
    setIsEditing(!isEditing);
  };

  // Get video duration when metadata is loaded
  const handleVideoMetadataLoaded = useCallback(() => {
    const video = lightboxVideoRef.current;
    if (video && video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
        setVideoDuration(video.duration);
    } else {
       setVideoDuration(0);
    }
  }, []);

  // Capture frame after seeking is complete
  const captureFrame = useCallback(async () => {
    const video = scrubVideoRef.current; // Use the hidden video
    const canvas = canvasRef.current;

    if (!video) {
        console.error("[FrameCapture] Scrub video ref is null.");
        toast({ title: "Cannot capture frame", description: "Frame selection video not available.", variant: "destructive" });
        return; // Don't set isCapturingFrame false here, wait for potential load
    }
    if (!canvas) {
        console.error("[FrameCapture] Canvas ref is null.");
        toast({ title: "Cannot capture frame", description: "Canvas element not available.", variant: "destructive" });
        return;
    }
    // Use readyState >= 2 (HAVE_CURRENT_DATA) - indicates current frame is available
    if (video.readyState < 2) {
        console.warn(`[FrameCapture] Scrub video readyState is ${video.readyState}. Waiting for data.`);
        toast({ title: "Capturing frame...", description: "Video data is loading.", variant: "default" });
        // Don't return immediately, allow seeked event to potentially re-trigger
        return; // Or maybe set a short timeout to retry?
    }

    setIsCapturingFrame(true);
    console.log(`[FrameCapture] Capturing frame from scrub video at ${video.currentTime.toFixed(2)}s`);

    try {
        // Ensure canvas dimensions match video intrinsic dimensions for best quality
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get data URL (e.g., image/jpeg for smaller size)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // Quality 0.9

        if (!dataUrl || dataUrl === 'data:,') {
           throw new Error('Failed to generate data URL from canvas');
        }

        // Clean up previous object URL if exists
        if (framePreviewUrl && framePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(framePreviewUrl);
        }
        setFramePreviewUrl(dataUrl);
        setHasCapturedNewFrame(true);
        console.log(`[FrameCapture] Frame captured successfully. Data URL length: ${dataUrl.length}`);
        toast({ title: "Thumbnail frame selected", description: `Selected frame at ${selectedTimestamp.toFixed(1)}s` });

    } catch (error: any) {
        console.error("[FrameCapture] Error capturing frame:", error);
        toast({
            title: "Frame Capture Failed",
            description: error.message || "Could not capture frame from video.",
            variant: "destructive",
        });
    } finally {
        setIsCapturingFrame(false);
    }
  }, []);

  // Handle slider value change (continuous seeking)
  const handleSliderChange = useCallback((value: number[]) => {
    const newTimestamp = value[0];
    setSelectedTimestamp(newTimestamp);
    const scrubVideo = scrubVideoRef.current;
    if (scrubVideo && isFinite(newTimestamp) && scrubVideo.readyState >= 1 /* HAVE_METADATA */) {
      scrubVideo.currentTime = newTimestamp;
      console.log(`[ScrubVideo] Seeked to ${newTimestamp.toFixed(2)}s`);
    } else if (scrubVideo) {
        console.warn(`[ScrubVideo] Tried to seek to ${newTimestamp.toFixed(2)}s but readyState is ${scrubVideo.readyState}`);
    }
  }, []);

  // Handle slider commit (capture frame after final seek)
  const handleSliderCommit = useCallback((value: number[]) => {
    const finalTimestamp = value[0];
    console.log(`[FrameCapture] Slider commit at ${finalTimestamp.toFixed(2)}s`);
  }, []);

  // Listen for 'seeked' event to trigger frame capture *after* seeking finishes
  useEffect(() => {
      const video = lightboxVideoRef.current;
      if (!video || !isEditing) return; // Only listen when editing

      let seekTimeout: NodeJS.Timeout | null = null;

      const handleSeeked = () => {
          console.log(`[FrameCapture] Video seeked to ${video.currentTime.toFixed(2)}s. Comparing with selected: ${selectedTimestamp.toFixed(2)}s`);
          // Debounce or check if the seek corresponds to the slider's intent
          // Check if current time is *very close* to the target timestamp
          if (Math.abs(video.currentTime - selectedTimestamp) < 0.1) {
              if (seekTimeout) clearTimeout(seekTimeout); // Clear previous timeout if rapid seeking
              // Delay capture slightly to ensure rendering catches up
              seekTimeout = setTimeout(() => {
                  if (!isCapturingFrame) { // Prevent concurrent captures
                      captureFrame();
                  }
              }, 150); // Adjust delay as needed
          }
      };

      video.addEventListener('seeked', handleSeeked);
      console.log("[FrameCapture] Added seeked event listener");

      return () => {
          video.removeEventListener('seeked', handleSeeked);
          if (seekTimeout) clearTimeout(seekTimeout);
          console.log("[FrameCapture] Removed seeked event listener");
      };
  }, [captureFrame]); // Remove dependencies on isEditing, selectedTimestamp, isCapturingFrame as capture is now triggered by scrubVideoRef's seeked event

  const handleSaveEdit = async () => {
    if (!canEdit || !videoId) return;
    setIsSaving(true);

    const newAssetId = editableAssetId === "" ? null : editableAssetId;
    let newThumbnailUrl: string | undefined | null = undefined;

    try {
      // Step 0: Prepare new thumbnail file if a frame was captured
      if (hasCapturedNewFrame && framePreviewUrl) {
          console.log("[SaveEdit] New frame captured, preparing for upload.");
          // Convert data URL to Blob
          const response = await fetch(framePreviewUrl);
          const blob = await response.blob();

          if (!blob || blob.size === 0) {
             throw new Error("Failed to convert captured frame data URL to Blob.");
          }
          console.log(`[SaveEdit] Converted data URL to Blob. Size: ${blob.size}, Type: ${blob.type}`);

          // THIS UPLOAD LOGIC WILL MOVE TO handleUpdateThumbnailFrame
          // For now, we just mark that a new URL *might* be generated if saved there.
          // We won't actually generate/upload it here.
          console.log(`[SaveEdit] Frame captured, but upload deferred to dedicated function.`);

      } else {
          console.log("[SaveEdit] No new frame captured, thumbnail will not be changed.");
      }

      // Step 2: Prepare update payload for 'media' table
      const mediaUpdatePayload: {
        title: string;
        description: string;
        classification: 'art' | 'gen';
      } = {
        title: editableTitle,
        description: editableDescription,
        classification: editableClassification,
      };

      // Step 3: Update media table
      console.log("[SaveEdit] Updating media table with payload:", mediaUpdatePayload);
      const { error: mediaUpdateError } = await supabase
        .from('media')
        .update(mediaUpdatePayload)
        .eq('id', videoId);

      if (mediaUpdateError) {
        console.error("[SaveEdit] Media update error:", mediaUpdateError);
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

      // Reset frame selection state after successful save & close
      setIsSelectingFrame(false);
      setFramePreviewUrl(null);
      setHasCapturedNewFrame(false);

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
    // Cleanup for the framePreviewUrl (Data URL or Object URL)
    const currentFramePreviewUrl = framePreviewUrl; // Capture the value
    return () => {
        if (currentFramePreviewUrl && currentFramePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(currentFramePreviewUrl);
            console.log("Revoked preview blob URL:", currentFramePreviewUrl);
        }
    };
  }, [framePreviewUrl]);

  // --- New handler for saving only the thumbnail frame ---
  const handleUpdateThumbnailFrame = async () => {
    if (!hasCapturedNewFrame || !framePreviewUrl || !videoId) {
      toast({ title: "Cannot Update", description: "No new frame has been selected.", variant: "default" });
      return;
    }

    setIsSavingThumbnail(true);
    console.log("[SaveThumbnail] Starting thumbnail update.");

    try {
      // 1. Convert data URL to Blob
      const response = await fetch(framePreviewUrl);
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("Failed to convert captured frame data URL to Blob.");
      }
      console.log(`[SaveThumbnail] Converted data URL to Blob. Size: ${blob.size}, Type: ${blob.type}`);

      // 2. Create a File object
      const fileExt = blob.type.split('/')[1] || 'jpg';
      const uniqueFileName = `frame_${Date.now()}_${videoId}.${fileExt}`;
      const thumbnailFile = new File([blob], uniqueFileName, { type: blob.type });
      console.log(`[SaveThumbnail] Created File object: ${thumbnailFile.name}, Size: ${thumbnailFile.size}`);

      // 3. Upload the thumbnail file
      const filePath = `public/${videoId}/${thumbnailFile.name}`;
      console.log("[SaveThumbnail] Uploading to:", filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media_thumbnails')
        .upload(filePath, thumbnailFile, {
          cacheControl: '3600',
          upsert: true // Upsert might be useful if filename generation is consistent, otherwise false
        });

      if (uploadError) {
        console.error("[SaveThumbnail] Thumbnail upload error:", uploadError);
        // Attempt to remove potentially partially uploaded file?
        await supabase.storage.from('media_thumbnails').remove([filePath]);
        throw new Error(`Failed to upload thumbnail: ${uploadError.message}.`);
      }
      console.log("[SaveThumbnail] Thumbnail uploaded successfully:", uploadData);

      // 4. Get Public URL
      const { data: urlData } = supabase.storage
        .from('media_thumbnails')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        console.error("[SaveThumbnail] Error getting public URL after upload");
        // Attempt to remove the orphaned file
        await supabase.storage.from('media_thumbnails').remove([filePath]);
        throw new Error("Failed to get thumbnail public URL after upload.");
      }
      const newThumbnailUrl = urlData.publicUrl;
      console.log("[SaveThumbnail] New thumbnail URL:", newThumbnailUrl);

      // 5. Update media table
      console.log("[SaveThumbnail] Updating media table placeholder_image for video:", videoId);
      const { error: mediaUpdateError } = await supabase
        .from('media')
        .update({ placeholder_image: newThumbnailUrl })
        .eq('id', videoId);

      if (mediaUpdateError) {
        console.error("[SaveThumbnail] Media update error:", mediaUpdateError);
        // Consider removing the uploaded thumbnail if DB update fails?
        // await supabase.storage.from('media_thumbnails').remove([filePath]);
        throw new Error(`Failed to update video record with new thumbnail: ${mediaUpdateError.message}`);
      }

      console.log("[SaveThumbnail] Media table updated successfully.");
      toast({ title: "Thumbnail Updated Successfully!" });

      // Exit frame selection mode
      setIsSelectingFrame(false);
      setHasCapturedNewFrame(false); // Reset capture state
      // Keep framePreviewUrl as the newly saved one? Or clear it?
      // Clearing might be safer to avoid showing stale preview if user cancels main edit later.
      // setFramePreviewUrl(null); 

      // Trigger parent refetch if necessary (optional, depends if parent shows thumbnails)
      if (onVideoUpdate) {
        Promise.resolve(onVideoUpdate()).catch(err => console.error("Error in onVideoUpdate callback after thumbnail save:", err));
      }

    } catch (error: any) {
      console.error("[SaveThumbnail] Error updating thumbnail:", error);
      toast({
        title: "Thumbnail Update Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSavingThumbnail(false);
      console.log("[SaveThumbnail] Thumbnail update operation finished.");
    }
  };

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
            className={cn("max-w-5xl p-0 bg-background flex flex-col", isMobile ? "max-h-screen" : "max-h-[90vh]")}
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
                // When NOT editing:
                // - Desktop: Limit video height to allow space for details below
                // - Mobile: Don't limit video height, let flexbox handle layout within max-h-screen
                isMobile ? "flex-shrink-0" : "max-h-[65vh] flex-shrink-0"
              )}>
                <VideoPlayer
                  ref={lightboxVideoRef}
                  src={videoUrl}
                  poster={initialThumbnailUrl}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  autoPlay={true}
                  muted={false}
                  isMobile={isMobile}
                  externallyControlled={isMobile}
                  isHovering={isMobile}
                  lazyLoad={false}
                  onLoadedMetadata={handleVideoMetadataLoaded}
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
                    const currentPreviewSrc = framePreviewUrl || initialThumbnailUrl || '';
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
                        <div className="space-y-3 order-1 md:order-2">
                           <Label className="text-sm font-medium text-muted-foreground block">Thumbnail Frame</Label>
                           <div className="aspect-video w-full bg-muted rounded overflow-hidden mb-2 relative group">
                             <img
                               key={framePreviewUrl || initialThumbnailUrl || 'empty'}
                               src={framePreviewUrl || initialThumbnailUrl || ''}
                               alt="Thumbnail preview"
                               className={cn(
                                  "w-full h-full object-cover transition-opacity duration-200",
                                  isCapturingFrame ? 'opacity-50' : 'opacity-100'
                               )}
                               onError={(e) => { e.currentTarget.style.opacity = '0'; }}
                               onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
                             />
                             {!framePreviewUrl && !initialThumbnailUrl && !isCapturingFrame && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                                   <span className="text-xs text-muted-foreground">No Thumbnail</span>
                                 </div>
                             )}
                           </div>
                           {!isSelectingFrame ? (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => setIsSelectingFrame(true)}
                               disabled={isSaving || !videoDuration}
                             >
                               <Camera className="mr-2 h-4 w-4" />
                               Update Thumbnail
                             </Button>
                           ) : (
                             <div className="space-y-1.5">
                               {videoDuration > 0 && (
                                 <>
                                   <Slider
                                     value={[selectedTimestamp]}
                                     onValueChange={handleSliderChange}
                                     onValueCommit={handleSliderCommit}
                                     max={videoDuration}
                                     step={0.1}
                                     disabled={isSaving || isCapturingFrame || isSavingThumbnail}
                                     aria-label="Select Frame Timestamp"
                                     className="py-2"
                                   />
                                   <div className="flex justify-between text-xs text-muted-foreground">
                                     <span>{selectedTimestamp.toFixed(1)}s</span>
                                     <span>{videoDuration.toFixed(1)}s</span>
                                   </div>
                                 </>
                               )}
                               <div className="flex justify-end gap-2 pt-1">
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => {
                                     setIsSelectingFrame(false);
                                     setFramePreviewUrl(null);
                                     setHasCapturedNewFrame(false);
                                   }}
                                   disabled={isSavingThumbnail}
                                 >
                                   Cancel
                                 </Button>
                                 <Button
                                   size="sm"
                                   onClick={handleUpdateThumbnailFrame}
                                   disabled={!hasCapturedNewFrame || isSavingThumbnail || isCapturingFrame}
                                 >
                                   {isSavingThumbnail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                   Update to this Frame
                                 </Button>
                               </div>
                             </div>
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
                            disabled={isSaving || isSavingThumbnail}
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

                {/* Hidden video element for scrubbing/frame capture */}
                {isEditing && videoUrl && (
                  <>
                    <video
                      ref={scrubVideoRef}
                      src={videoUrl}
                      muted
                      playsInline
                      preload="auto" // Preload for seeking
                      crossOrigin="anonymous"
                      className="absolute w-px h-px -left-full -top-full opacity-0 pointer-events-none" // Visually hidden
                      onLoadedMetadata={() => {
                        // Ensure duration is set based on this video too, if needed
                        if (scrubVideoRef.current && !videoDuration) {
                          setVideoDuration(scrubVideoRef.current.duration || 0);
                        }
                        console.log(`[ScrubVideo] Metadata loaded. Duration: ${scrubVideoRef.current?.duration}`);
                      }}
                      onSeeked={() => {
                        // Trigger frame capture from *this* video when seek completes
                        console.log(`[ScrubVideo] Seeked event on hidden video at ${scrubVideoRef.current?.currentTime.toFixed(2)}s. Capturing frame.`);
                        captureFrame(); // Capture from scrubVideoRef
                      }}
                      onError={(e) => {
                        console.error("[ScrubVideo] Error loading hidden video:", e);
                        toast({ title: "Frame Preview Error", description: "Could not load video data for frame selection.", variant: "destructive" });
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute w-px h-px -left-full -top-full opacity-0 pointer-events-none"
                    />
                  </>
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
