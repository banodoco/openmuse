import React, { useState } from 'react';
import { LoraAsset } from '@/lib/types';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface LoraCardProps {
  lora: LoraAsset;
  isAdmin?: boolean;
}

const LoraCard: React.FC<LoraCardProps> = ({ lora, isAdmin = false }) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const { user } = useAuth();
  
  const videoUrl = lora.primaryVideo?.video_location;
  
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
      lora.admin_approved = 'Curated';
    } catch (error) {
      console.error('Error curating LoRA:', error);
      toast.error('Failed to curate LoRA');
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
      lora.admin_approved = 'Rejected';
    } catch (error) {
      console.error('Error rejecting LoRA:', error);
      toast.error('Failed to reject LoRA');
    } finally {
      setIsRejecting(false);
    }
  };
  
  const getApprovalStatus = () => {
    const status = lora.admin_approved;
    if (status === 'Curated') {
      return <Badge className="bg-green-500">Curated</Badge>;
    } else if (status === 'Rejected') {
      return <Badge variant="destructive">Rejected</Badge>;
    } else {
      return <Badge variant="outline">Listed</Badge>;
    }
  };
  
  return (
    <Card 
      className="overflow-hidden transition-all h-full flex flex-col cursor-pointer hover:shadow-md" 
      onClick={handleView}
    >
      <div 
        className="aspect-video w-full overflow-hidden bg-muted relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {videoUrl ? (
          <VideoPreview 
            url={videoUrl} 
            className="w-full h-full object-cover" 
            title={lora.name}
            creator={lora.creator}
            isHovering={isHovering}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No preview available</p>
          </div>
        )}
        
        <div className={cn(
          "absolute top-0 left-0 w-full p-3 z-10 bg-gradient-to-b from-black/60 to-transparent text-white",
          isHovering ? "opacity-0" : "opacity-100",
          "transition-opacity duration-200"
        )}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium truncate mr-2">{lora.name}</h3>
            {getApprovalStatus()}
          </div>
          
          {lora.creator && (
            <p className="text-xs text-white/80 mt-1">{lora.creator}</p>
          )}
        </div>
      </div>
      
      <CardContent className="px-4 py-3 text-xs flex-grow">
        {lora.description && (
          <p className="text-muted-foreground mb-2 line-clamp-2">{lora.description}</p>
        )}
        
        {lora.lora_type && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium truncate max-w-[60%] text-right">{lora.lora_type}</span>
          </div>
        )}
        
        {lora.lora_link && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-2 w-full h-7 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              window.open(lora.lora_link, '_blank');
            }}
          >
            <ExternalLink className="h-3 w-3" />
            View Original
          </Button>
        )}
      </CardContent>
      
      {isAdmin && (
        <CardFooter className="p-3 border-t grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm" 
                className="text-xs h-8 w-full"
                disabled={isDeleting}
              >
                <Trash className="h-3 w-3 mr-1" /> 
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this LoRA and all its associated data.
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
          
          <div className="col-span-2 grid grid-cols-2 gap-2 mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCurate}
              disabled={isApproving || lora.admin_approved === 'Curated'}
              className={cn(
                "text-xs h-8 w-full",
                lora.admin_approved === 'Curated' && "bg-green-500/10"
              )}
            >
              <Check className="h-3 w-3 mr-1" /> 
              Curate
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReject}
              disabled={isRejecting || lora.admin_approved === 'Rejected'}
              className={cn(
                "text-xs h-8 w-full",
                lora.admin_approved === 'Rejected' && "bg-red-500/10"
              )}
            >
              <X className="h-3 w-3 mr-1" /> 
              Reject
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default LoraCard;
