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
import { AuthContext } from '@/contexts/AuthContext';
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
  onAdminStatusChange,
  hasPrev,
  onPrevVideo,
  hasNext,
  onNextVideo,
  classification: initialClassification = 'gen'
}) => {
  const { user, isAdmin } = useAuth();

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

  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    setEditableTitle(initialTitle || '');
    setEditableDescription(initialDescription || '');
    setEditableAssetId(initialAssetId || '');
    setEditableClassification(initialClassification);
    setIsEditing(false);
  }, [videoId, initialTitle, initialDescription, initialAssetId, initialClassification]);

  useEffect(() => {
    const fetchLoras = async () => {
      if (isOpen && availableLoras.length === 0 && !isFetchingLoras) {
        setIsFetchingLoras(true);
        try {
          const { data, error } = await supabase
            .from('assets')
            .select('id, name')
            .eq('type', 'lora')
            .order('name', { ascending: true });

          if (error) {
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
  }, [isOpen, availableLoras.length, isFetchingLoras, toast]);

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
      // Step 1: Update media title, description and classification
      const { error: mediaUpdateError } = await supabase
        .from('media')
        .update({
          title: editableTitle,
          description: editableDescription,
          classification: editableClassification
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
      
      // Close the lightbox immediately so the user stays in context
      onClose();

      // Exit edit mode (component will unmount shortly after onClose)
      setIsEditing(false);

      // Trigger potential refetch in parent component WITHOUT blocking UI
      if (onVideoUpdate) {
        // Run asynchronously, do not await to avoid UI reset before close
        onVideoUpdate();
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
                {isEditing ? editableTitle : initialTitle || 'Video'}
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
                isEditing ? "max-h-[35vh] flex-shrink" : "max-h-[65vh] flex-shrink-0"
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
                    return (
                      <div className="space-y-4">
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
                        
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveEdit}
                            disabled={isSaving}
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
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                                     <Trash size={16} />
                                     <span className="sr-only">Delete</span>
                                  </Button>
                               </AlertDialogTrigger>
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
                              to={`/assets/${initialAssetId}`}
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
