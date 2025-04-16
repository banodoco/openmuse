import React, { useState, useEffect, useRef } from 'react';
import { LoraAsset } from '@/lib/types';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Trash, Check, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

const logger = new Logger('LoraCard');

interface LoraCardProps {
  lora: LoraAsset;
  isAdmin?: boolean;
}

const LoraCard: React.FC<LoraCardProps> = ({ 
  lora, 
  isAdmin = false, 
}) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const { user } = useAuth();
  
  const videoUrl = lora.primaryVideo?.video_location;
  const thumbnailUrl = lora.primaryVideo?.metadata?.thumbnailUrl;
  
  const getCreatorName = () => {
    if (lora.creatorDisplayName) return lora.creatorDisplayName;
    
    const creator = lora.creator;
    if (!creator) return "Unknown";
    
    if (creator.includes('@')) {
      return creator.split('@')[0];
    }
    
    return creator;
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
  
  const handleCurate = async () => {
    if (!isAdmin) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Curated' })
        .eq('id', lora.id);
      
      if (error) throw error;
      
      toast.success('LoRA curated successfully');
    } catch (error) {
      console.error('Error curating LoRA:', error);
      toast.error('Failed to curate LoRA');
    } finally {
      setIsApproving(false);
    }
  };
  
  const handleList = async () => {
    if (!isAdmin) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Listed' })
        .eq('id', lora.id);
      
      if (error) throw error;
      
      toast.success('LoRA listed successfully');
    } catch (error) {
      console.error('Error listing LoRA:', error);
      toast.error('Failed to list LoRA');
    } finally {
      setIsApproving(false);
    }
  };
  
  const handleReject = async () => {
    if (!isAdmin) return;
    
    setIsRejecting(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Rejected' })
        .eq('id', lora.id);
      
      if (error) throw error;
      
      toast.success('LoRA rejected');
    } catch (error) {
      console.error('Error rejecting LoRA:', error);
      toast.error('Failed to reject LoRA');
    } finally {
      setIsRejecting(false);
    }
  };
  
  return (
    <Card 
      className="overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-md" 
      onClick={handleView}
    >
      <div 
        className="aspect-video w-full overflow-hidden bg-muted relative"
      >
        {videoUrl ? (
          <VideoPreview 
            url={videoUrl} 
            className="w-full h-full object-cover" 
            title={lora.name}
            creator={getCreatorName()}
            lazyLoad={true}
            thumbnailUrl={thumbnailUrl}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No preview available</p>
          </div>
        )}
        {isAdmin && lora.admin_approved && (
           <Badge
             variant={
               lora.admin_approved === 'Curated' ? 'default' :
               lora.admin_approved === 'Rejected' ? 'destructive' :
               'outline'
             }
             className="absolute top-2 right-2 text-xs"
           >
             {lora.admin_approved}
           </Badge>
         )}
      </div>
      
      <CardContent className="p-3 flex-grow flex flex-col">
        <div className="mb-2">
          <h3 className="font-medium text-sm truncate flex-1">{lora.name}</h3>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground mt-auto">
          {lora.lora_base_model && (
            <p><span className="font-medium text-foreground">Base:</span> {lora.lora_base_model}</p>
          )}
          {lora.model_variant && (
            <p><span className="font-medium text-foreground">Variant:</span> {lora.model_variant}</p>
          )}
          {lora.lora_type && (
             <p><span className="font-medium text-foreground">Type:</span> {lora.lora_type}</p>
          )}
          {getCreatorName() && (
            <p><span className="font-medium text-foreground">Creator:</span> {getCreatorName()}</p>
          )}
          {lora.created_at && (
             <p><span className="font-medium text-foreground">Created:</span> {new Date(lora.created_at).toLocaleDateString()}</p>
           )}
        </div>
      </CardContent>
      
      {isAdmin && (
        <CardFooter className="p-3 border-t flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2 w-full">
            <Button
              variant={lora.admin_approved === 'Curated' ? 'success' : 'outline'}
              size="sm"
              className="text-xs h-8 flex-1"
              onClick={handleCurate}
              disabled={isApproving || isRejecting || isDeleting || lora.admin_approved === 'Curated'}
            >
              <Check className="h-3 w-3 mr-1" /> Curate
            </Button>
             <Button
              variant={lora.admin_approved === 'Listed' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8 flex-1"
              onClick={handleList}
              disabled={isApproving || isRejecting || isDeleting || lora.admin_approved === 'Listed'}
            >
               List
            </Button>
            <Button
               variant={lora.admin_approved === 'Rejected' ? 'destructive' : 'outline'}
               size="sm"
               className="text-xs h-8 flex-1"
               onClick={handleReject}
               disabled={isRejecting || isApproving || isDeleting || lora.admin_approved === 'Rejected'}
            >
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
          </div>
           <AlertDialog>
             <AlertDialogTrigger asChild>
               <Button
                 variant="destructive"
                 size="sm"
                 className="text-xs h-8 w-full"
                 disabled={isDeleting || isApproving || isRejecting}
               >
                 <Trash className="h-3 w-3 mr-1" />
                 Delete
               </Button>
             </AlertDialogTrigger>
             <AlertDialogContent>
               <AlertDialogHeader>
                 <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                 <AlertDialogDescription>
                   This will permanently delete this LoRA and all its associated data. This action cannot be undone.
                 </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                 <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                   {isDeleting ? 'Deleting...' : 'Delete'}
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
