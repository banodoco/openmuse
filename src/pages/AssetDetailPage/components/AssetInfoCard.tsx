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
  Edit,
  Trash,
  EyeOff
} from 'lucide-react';
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoraAsset } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import EditableLoraDetails from '@/components/lora/EditableLoraDetails';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
import { Logger } from "@/lib/logger";

const logger = new Logger('AssetInfoCard');

interface AssetInfoCardProps {
  asset: LoraAsset | null;
  isAuthorizedToEdit: boolean;
  isAdmin: boolean;
  isApproving: boolean;
  handleCurateAsset: () => Promise<void>;
  handleListAsset: () => Promise<void>;
  handleRejectAsset: () => Promise<void>;
  handleDeleteAsset: () => Promise<void>;
  getCreatorName: () => string;
  creatorDisplayName?: string;
}

const AssetInfoCard = ({
  asset,
  isAuthorizedToEdit,
  isAdmin,
  isApproving,
  handleCurateAsset,
  handleListAsset,
  handleRejectAsset,
  handleDeleteAsset,
  getCreatorName,
  creatorDisplayName,
}: AssetInfoCardProps) => {
  const { isAdmin: authAdmin, user } = useAuth();
  const [isDeleting, setIsDeleting] = React.useState(false);

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

  const onDeleteConfirm = async () => {
    logger.log(`[AssetInfoCard] onDeleteConfirm triggered for asset ID: ${asset?.id}`);
    if (!handleDeleteAsset) {
      logger.warn(`[AssetInfoCard] handleDeleteAsset prop is missing for asset ID: ${asset?.id}`);
      toast.error("Delete function is unavailable."); 
      setIsDeleting(false);
      return;
    }
    
    logger.log(`[AssetInfoCard] Calling handleDeleteAsset prop for asset ID: ${asset?.id}`);
    setIsDeleting(true);
    try {
      await handleDeleteAsset();
      logger.log(`[AssetInfoCard] handleDeleteAsset prop finished successfully for asset ID: ${asset?.id}`);
    } catch (error) {
      logger.error(`[AssetInfoCard] Error executing handleDeleteAsset prop for asset ID ${asset?.id}:`, error);
      setIsDeleting(false); 
    } 
    logger.log(`[AssetInfoCard] onDeleteConfirm finished for asset ID: ${asset?.id}`);
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

          {/* Admin Moderation Buttons */}
          {isAdmin && (
            <>
              <Button
                onClick={handleCurateAsset}
                className="w-full gap-2"
                disabled={isApproving || asset?.admin_status === 'Curated'}
              >
                <Check className="h-4 w-4" />
                Curate
              </Button>
              <Button
                onClick={handleListAsset}
                variant="secondary"
                className="w-full gap-2"
                disabled={isApproving || asset?.admin_status === 'Listed'}
              >
                <Check className="h-4 w-4" />
                List
              </Button>
              <Button
                onClick={handleRejectAsset}
                variant="outline"
                className={cn(
                  "w-full gap-2",
                  "border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700",
                  (isApproving || asset?.admin_status === 'Rejected') && "bg-orange-100 opacity-70 cursor-not-allowed"
                )}
                disabled={isApproving || asset?.admin_status === 'Rejected'}
              >
                <EyeOff className="h-4 w-4" />
                Hide
              </Button>
            </>
          )}

          {/* Delete LoRA Button - Moved to the bottom, visible to authorized users */}
          {isAuthorizedToEdit && (
             <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full gap-2 mt-4"
                    disabled={isDeleting}
                  >
                    <Trash className="h-4 w-4" />
                    {isDeleting ? 'Deleting...' : 'Delete LoRA'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the LoRA asset
                      and potentially associated data (like videos, depending on setup).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={onDeleteConfirm} 
                      disabled={isDeleting}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          )}
          
        </CardFooter>
      </Card>
    </div>
  );
};

export default AssetInfoCard;
