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
  EyeOff,
  PinIcon,
  List
} from 'lucide-react';
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoraAsset, UserAssetPreferenceStatus } from '@/lib/types';
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
  userIsLoggedIn: boolean;
  currentStatus: UserAssetPreferenceStatus | null;
  onStatusChange: (newStatus: UserAssetPreferenceStatus) => void;
  isAdmin: boolean;
  isAuthorized: boolean;
  isApproving: boolean;
  onCurate: () => Promise<void>;
  onList: () => Promise<void>;
  onReject: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const AssetInfoCard = ({
  asset,
  isAuthorizedToEdit,
  userIsLoggedIn,
  currentStatus,
  onStatusChange,
  isAdmin,
  isAuthorized,
  isApproving,
  onCurate,
  onList,
  onReject,
  onDelete
}: AssetInfoCardProps) => {
  const { user } = useAuth();
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleStatusClick = async (newStatus: UserAssetPreferenceStatus) => {
    if (!onStatusChange || !userIsLoggedIn) return;
    
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(newStatus);
    } catch (error) {
      logger.error("[AssetInfoCard] Status change failed:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusButtonStyle = (status: UserAssetPreferenceStatus) => {
    const isActive = currentStatus === status;
    return cn(
      "text-xs h-8 flex-1",
      isActive && status === 'Pinned' && "bg-green-500 text-white hover:bg-green-600",
      isActive && status === 'Listed' && "bg-blue-500 text-white hover:bg-blue-600",
      isActive && status === 'Hidden' && "bg-gray-500 text-white hover:bg-gray-600",
      !isActive && "bg-transparent"
    );
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      logger.error("Error during asset deletion confirmation:", error);
    } finally {
      setIsDeleting(false);
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
            onDetailsUpdated={() => { /* TODO: Trigger refetch from parent */ }}
          />
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4 border-t pt-4">
          {/* External Link Button */}
          {asset?.lora_link && (
            <a 
              href={asset.lora_link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline' }), "w-full gap-2")}
            > 
              <ExternalLink className="h-4 w-4" />
              View External Link
            </a>
          )}

          {/* User Status Buttons (Owner/Admin Only) */}
          {isAuthorized && (
            <div className="grid grid-cols-3 gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleStatusClick('Pinned')}
                disabled={isUpdatingStatus}
                className={getStatusButtonStyle('Pinned')}
              >
                <PinIcon className="h-3 w-3 mr-1" /> 
                Pin
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleStatusClick('Listed')}
                disabled={isUpdatingStatus}
                className={getStatusButtonStyle('Listed')}
              >
                <List className="h-3 w-3 mr-1" />
                List
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleStatusClick('Hidden')}
                disabled={isUpdatingStatus}
                className={getStatusButtonStyle('Hidden')}
              >
                <EyeOff className="h-3 w-3 mr-1" /> 
                Hide
              </Button>
            </div>
          )}
          
          {/* --- Admin Section --- */}
          {/* Only render this whole section if isAdmin is true */}
          {isAdmin && (
            <>
              {/* Separator if both user status and admin buttons are shown */}
              {isAuthorized && <hr className="w-full my-2" />} 

              {/* Admin Box */}
              <div className="w-full p-3 border border-yellow-500 rounded-md bg-yellow-50/50 space-y-3">
                <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">Admin Controls</p>
                
                {/* Admin Moderation Buttons */}
                <div className="grid grid-cols-3 gap-2 w-full">
                  {/* Curate Button */}
                  <Button
                    size="sm"
                    onClick={onCurate}
                    className="gap-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                    disabled={isApproving || asset?.admin_status === 'Curated'}
                  >
                    <Check className="h-4 w-4" /> Curate
                  </Button>
                  {/* List Button */}
                  <Button
                    size="sm"
                    onClick={onList}
                    variant="secondary"
                    className="gap-1 h-8 text-xs"
                    disabled={isApproving || asset?.admin_status === 'Listed'}
                  >
                    <Check className="h-4 w-4" /> List
                  </Button>
                  {/* Hide Admin Button */}
                  <Button
                    size="sm"
                    onClick={onReject}
                    variant="outline"
                    className={cn(
                      "gap-1 h-8 text-xs",
                      "border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700",
                      (isApproving || asset?.admin_status === 'Rejected') && "bg-orange-100 opacity-70 cursor-not-allowed"
                    )}
                    disabled={isApproving || asset?.admin_status === 'Rejected'}
                  >
                    <EyeOff className="h-4 w-4" /> Hide Admin
                  </Button>
                </div>
              </div>
            </>
          )}
          {/* --- End Admin Section --- */}

          {/* Delete Button - Still visible to Owner or Admin */}
          {isAuthorized && (
             <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2 mt-2 h-8 text-xs"
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
                      and all associated videos/data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteConfirm} 
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
