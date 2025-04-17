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
      lora.admin_approved = 'Listed';
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
      lora.admin_approved = 'Rejected';
    } catch (error) {
      console.error('Error rejecting LoRA:', error);
      toast.error('Failed to reject LoRA');
    } finally {
      setIsRejecting(false);
    }
  };
  
  const getButtonStyle = (status: string) => {
    const isActive = lora.admin_approved === status;
    
    return cn(
      "text-xs h-8 flex-1",
      isActive && status === 'Curated' && "bg-green-500 text-white hover:bg-green-600",
      isActive && status === 'Listed' && "bg-blue-500 text-white hover:bg-blue-600",
      isActive && status === 'Rejected' && "bg-red-500 text-white hover:bg-red-600",
      !isActive && "bg-transparent"
    );
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
      </div>
      
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-sm truncate flex-1">{lora.name}</h3>
          {getModelDisplay() && (
            <Badge 
              variant="model" 
              className={cn("ml-2 text-xs px-2 py-0.5 h-5", getModelColor(lora.lora_base_model))}
            >
              {getModelDisplay()}
            </Badge>
          )}
        </div>
        {getCreatorName() && (
          <p className="text-xs text-muted-foreground">Creator: {getCreatorName()}</p>
        )}
      </CardContent>
      
      {isAdmin && (
        <CardFooter className="p-3 border-t grid gap-2" onClick={(e) => e.stopPropagation()}>
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
          
          <div className="col-span-1 grid grid-cols-3 gap-2 mt-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCurate}
              disabled={isApproving}
              className={getButtonStyle('Curated')}
            >
              <Check className="h-3 w-3 mr-1" /> 
              Curate
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleList}
              disabled={isApproving}
              className={getButtonStyle('Listed')}
            >
              List
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReject}
              disabled={isRejecting}
              className={getButtonStyle('Rejected')}
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
