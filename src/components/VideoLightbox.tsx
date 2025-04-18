import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Pencil, Save, XCircle, Trash } from 'lucide-react';
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

interface VideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoId: string;
  title?: string;
  description?: string;
  loraIdentifier?: string;
  creator?: string | null;
  thumbnailUrl?: string;
  creatorId?: string;
  onVideoUpdate?: () => void;
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
  loraIdentifier: initialLoraIdentifier,
  creator,
  thumbnailUrl,
  creatorId,
  onVideoUpdate
}) => {
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
  const [editableLoraIdentifier, setEditableLoraIdentifier] = useState(initialLoraIdentifier || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [availableLoras, setAvailableLoras] = useState<LoraOption[]>([]);
  const [isFetchingLoras, setIsFetchingLoras] = useState(false);

  const canEdit = isAdmin || (user?.id && user.id === creatorId);

  useEffect(() => {
    setEditableTitle(initialTitle || '');
    setEditableDescription(initialDescription || '');
    setEditableLoraIdentifier(initialLoraIdentifier || '');
    setIsEditing(false);
  }, [videoId, initialTitle, initialDescription, initialLoraIdentifier]);

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
    setEditableLoraIdentifier(initialLoraIdentifier || '');
  }, [initialTitle, initialDescription, initialLoraIdentifier]);

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
      console.log(`[VideoLightboxDebug] Entering edit mode. Initial LoRA from props: '${initialLoraIdentifier}'`);
      setEditableTitle(initialTitle || '');
      setEditableDescription(initialDescription || '');
      setEditableLoraIdentifier(initialLoraIdentifier || '');
      console.log(`[VideoLightboxDebug] Set editableLoraIdentifier state to: '${initialLoraIdentifier || ''}'`);
    } else {
      console.log('[VideoLightboxDebug] Leaving edit mode.');
    } 
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    if (!canEdit || !videoId) return;
    setIsSaving(true);
    console.log('[VideoLightboxDebug] handleSaveEdit: Starting save process...');

    const updates = {
      title: editableTitle,
      description: editableDescription,
      lora_identifier: editableLoraIdentifier === "" ? null : editableLoraIdentifier,
    };
    console.log('[VideoLightboxDebug] handleSaveEdit: Prepared updates:', updates);
    console.log(`[VideoLightboxDebug] handleSaveEdit: Attempting update for videoId: ${videoId}`);

    try {
      const { error } = await supabase
        .from('videos')
        .update(updates)
        .eq('id', videoId);

      console.log('[VideoLightboxDebug] handleSaveEdit: Supabase update result:', { error });

      if (error) throw error;

      toast({
        title: "Video updated successfully!",
      });
      console.log('[VideoLightboxDebug] handleSaveEdit: Update successful, toast shown.');
      setIsEditing(false);
      if (onVideoUpdate) {
        console.log('[VideoLightboxDebug] handleSaveEdit: Calling onVideoUpdate...');
        onVideoUpdate();
      }

    } catch (error: any) {
      console.error('[VideoLightboxDebug] handleSaveEdit: Error updating video:', error);
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
        .from('videos')
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

  const loraDisplayText = initialLoraIdentifier
    ? availableLoras.find(l => l.id === initialLoraIdentifier)?.name ?? initialLoraIdentifier
    : null;

  return (
    <AlertDialog>
      <Dialog open={isOpen} onOpenChange={(open) => {
          if (!open) {
              if (isEditing) handleCancelEdit();
              onClose();
          }
      }}>
        <DialogContent className="max-w-5xl p-0 bg-background top-[5vh] h-[90vh] translate-y-0 [&>button.absolute.right-4.top-4]:hidden flex flex-col">
          <div className="relative flex flex-col h-full">
            <button
              onClick={() => {
                  if (isEditing) handleCancelEdit();
                  onClose();
              }}
              className="absolute top-2 right-2 z-30 bg-black/50 rounded-full p-2 text-white hover:bg-black/70 transition-all"
              aria-label="Close"
            >
              <X size={24} />
            </button>
            
            <div className={cn(
              "p-4 flex-shrink",
              isEditing ? "max-h-[40vh]" : "max-h-[75vh]"
            )}>
              <VideoPlayer
                src={videoUrl}
                poster={thumbnailUrl}
                className="rounded-md w-full h-auto max-h-full object-contain"
                controls
                autoPlay
                externallyControlled={true}
                isHovering={true}
                isMobile={isMobile}
                muted={false}
              />
            </div>
            
            <div className="p-4 pt-0 flex-grow overflow-y-auto min-h-0">
              {isEditing ? (() => { 
                  console.log(`[VideoLightboxDebug] Rendering Edit Form. Current editableLoraIdentifier state: '${editableLoraIdentifier}'`);
                  const selectValue = editableLoraIdentifier || "";
                  console.log(`[VideoLightboxDebug] Rendering Select component with value: '${selectValue}'`);
                  console.log('[VideoLightboxDebug] availableLoras:', availableLoras);
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
                               console.log(`[VideoLightboxDebug] LoRA Select onValueChange: new value selected: '${value}'`);
                               setEditableLoraIdentifier(value === "__NONE__" ? "" : value);
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
                                console.log('[VideoLightboxDebug] Save Changes button clicked!');
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
                    {initialDescription && <p className="text-sm text-muted-foreground">{initialDescription}</p>}
                    {loraDisplayText && (
                      <p className="text-xs text-muted-foreground italic">
                        LoRA: {loraDisplayText}
                      </p>
                    )}
                    <div className="text-sm text-muted-foreground">{displayCreator}</div>
                  </div>
                )}
            </div>
          </div>
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
