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
  EyeOff,
  PinIcon,
  List,
  Flame,
  ListChecks,
  Pencil,
  Trash
} from 'lucide-react';
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoraAsset, UserAssetPreferenceStatus, AdminStatus } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import EditableLoraDetails, { EditableLoraDetailsHandle } from '@/components/lora/EditableLoraDetails';
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
  isUpdatingAdminStatus: boolean;
  onAdminStatusChange: (newStatus: AdminStatus) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Callback fired after the LoRA details have been updated so parent can refetch/refresh */
  onDetailsUpdated: () => void;
}

const AssetInfoCard = ({
  asset,
  isAuthorizedToEdit,
  userIsLoggedIn,
  currentStatus,
  onStatusChange,
  isAdmin,
  isAuthorized,
  isUpdatingAdminStatus,
  onAdminStatusChange,
  onDelete,
  onDetailsUpdated
}: AssetInfoCardProps) => {
  const { user } = useAuth();
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Ref to control EditableLoraDetails actions (e.g., start editing)
  const editableDetailsRef = React.useRef<EditableLoraDetailsHandle>(null);

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
        <CardHeader className="pb-2 flex items-start justify-between">
          <CardTitle>LoRA Information</CardTitle>
          {isAuthorizedToEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 py-1.5"
              onClick={() => editableDetailsRef.current?.startEdit()}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <EditableLoraDetails 
            ref={editableDetailsRef}
            asset={asset}
            isAuthorized={isAuthorizedToEdit}
            onDetailsUpdated={onDetailsUpdated}
            hideEditButton
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

          {/* User Status Buttons (Owner/Admin Only) - Reversed Order */}
          {isAuthorized && (
            <div className="grid grid-cols-3 gap-2 w-full">
              {/* Hide Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleStatusClick('Hidden')}
                disabled={isUpdatingStatus}
                className={getStatusButtonStyle('Hidden')}
              >
                <EyeOff className="h-3 w-3 mr-1" /> 
                <span className="hidden lg:inline">Hide</span>
              </Button>
              
              {/* List Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleStatusClick('Listed')}
                disabled={isUpdatingStatus}
                className={getStatusButtonStyle('Listed')}
              >
                <List className="h-3 w-3 mr-1" />
                <span className="hidden lg:inline">List</span>
              </Button>
              
              {/* Pin Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleStatusClick('Pinned')}
                disabled={isUpdatingStatus}
                className={getStatusButtonStyle('Pinned')}
              >
                <PinIcon className="h-3 w-3 mr-1" /> 
                <span className="hidden lg:inline">Pin</span>
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
                
                {/* Admin Moderation Buttons - Reordered to Hidden, Listed, Curated, Featured */}
                <div className="grid grid-cols-2 gap-2 w-full">
                  {/* Hidden Button */}
                  <Button
                    size="sm"
                    variant={asset?.admin_status === 'Hidden' ? "secondary" : "outline"}
                    onClick={() => onAdminStatusChange('Hidden')}
                    className="gap-1 h-8 text-xs"
                    disabled={isUpdatingAdminStatus || asset?.admin_status === 'Hidden'}
                  >
                    <EyeOff className="h-4 w-4" /> Hide
                  </Button>
                  {/* Listed Button */}
                  <Button
                    size="sm"
                    variant={asset?.admin_status === 'Listed' ? "secondary" : "outline"}
                    onClick={() => onAdminStatusChange('Listed')}
                    className="gap-1 h-8 text-xs"
                    disabled={isUpdatingAdminStatus || asset?.admin_status === 'Listed'}
                  >
                    <List className="h-4 w-4" /> List
                  </Button>
                  {/* Curated Button */}
                  <Button
                    size="sm"
                    variant={asset?.admin_status === 'Curated' ? "secondary" : "outline"}
                    onClick={() => onAdminStatusChange('Curated')}
                    className="gap-1 h-8 text-xs"
                    disabled={isUpdatingAdminStatus || asset?.admin_status === 'Curated'}
                  >
                    <ListChecks className="h-4 w-4" /> Curate
                  </Button>
                  {/* Featured Button */}
                  <Button
                    size="sm"
                    variant={asset?.admin_status === 'Featured' ? "secondary" : "outline"}
                    onClick={() => onAdminStatusChange('Featured')}
                    className="gap-1 h-8 text-xs"
                    disabled={isUpdatingAdminStatus || asset?.admin_status === 'Featured'}
                  >
                    <Flame className="h-4 w-4" /> Feature
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
