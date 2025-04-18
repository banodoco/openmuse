// @ts-nocheck
import * as React from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { 
  Calendar, 
  User, 
  Check, 
  X, 
  Info,
  ExternalLink,
  Edit
} from 'lucide-react';
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoraAsset } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import EditableLoraDetails from '@/components/lora/EditableLoraDetails';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AssetInfoCardProps {
  asset: LoraAsset | null;
  isAuthorizedToEdit: boolean;
}

const AssetInfoCard = ({
  asset,
  isAuthorizedToEdit,
}: AssetInfoCardProps) => {
  const { isAdmin, user } = useAuth();
  const [isApproving, setIsApproving] = useState(false);

  const handleCurateAsset = async () => {
    if (!asset || !isAdmin) return;
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Curated' })
        .eq('id', asset.id);
      
      if (error) throw error;
      toast.success('Asset curated successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error curating asset:', error);
      toast.error('Failed to curate asset');
    } finally {
      setIsApproving(false);
    }
  };

  const handleListAsset = async () => {
    if (!asset || !isAdmin) return;
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Listed' })
        .eq('id', asset.id);
      
      if (error) throw error;
      toast.success('Asset listed successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error listing asset:', error);
      toast.error('Failed to list asset');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectAsset = async () => {
    if (!asset || !isAdmin) return;
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Rejected' })
        .eq('id', asset.id);
      
      if (error) throw error;
      toast.success('Asset rejected successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error rejecting asset:', error);
      toast.error('Failed to reject asset');
    } finally {
      setIsApproving(false);
    }
  };

  const getModelColor = (modelType?: string): string => {
    switch (modelType?.toLowerCase()) {
      case 'wan':
        return "bg-blue-500 text-white";
      case 'hunyuan':
        return "bg-purple-500 text-white";
      case 'ltxv':
        return "bg-amber-500 text-white";
      case 'cogvideox':
        return "bg-emerald-500 text-white";
      case 'animatediff':
        return "bg-pink-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getStatusColor = (status?: string | null): string => {
    switch (status) {
      case 'Curated':
        return "bg-green-500 text-white";
      case 'Listed':
        return "bg-blue-500 text-white";
      case 'Rejected':
        return "bg-red-500 text-white";
      default:
        return "bg-yellow-500 text-white";
    }
  };

  return (
    <div className="md:col-span-1 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>LoRA Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EditableLoraDetails 
            asset={asset}
            isAuthorized={isAuthorizedToEdit}
            onDetailsUpdated={() => window.location.reload()}
          />
        </CardContent>
        
        <CardFooter className="flex flex-col gap-2 border-t pt-4">
          {/* External Link Button - Always visible if link exists */}
          {asset?.lora_link && (
            <a 
              href={asset.lora_link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants(), "w-full gap-2")}
            > 
              <ExternalLink className="h-4 w-4" />
              View External Link
            </a>
          )}

          {/* Edit Button - Visible to authorized users */}
          {isAuthorizedToEdit && (
            <Button
              onClick={() => {/* Add edit handler */}}
              variant="secondary"
              className="w-full gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Details
            </Button>
          )}

          {/* Admin Moderation Buttons */}
          {isAdmin && (
            <>
              <Button
                onClick={handleCurateAsset}
                className="w-full gap-2"
                disabled={isApproving || asset?.admin_approved === 'Curated'}
              >
                <Check className="h-4 w-4" />
                Curate
              </Button>
              <Button
                onClick={handleListAsset}
                variant="secondary"
                className="w-full gap-2"
                disabled={isApproving || asset?.admin_approved === 'Listed'}
              >
                <Check className="h-4 w-4" />
                List
              </Button>
              <Button
                onClick={handleRejectAsset}
                variant="destructive"
                className="w-full gap-2"
                disabled={isApproving || asset?.admin_approved === 'Rejected'}
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default AssetInfoCard;
