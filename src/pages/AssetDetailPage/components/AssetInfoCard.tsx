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
import { Badge } from "@/components/ui/badge";
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
  Trash,
  Copy,
  Download
} from 'lucide-react';
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnyAsset, UserAssetPreferenceStatus, AdminStatus, UserProfile, LoraAsset, WorkflowAsset } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import EditableAssetDetails, { EditableAssetDetailsHandle } from '@/components/asset/EditableAssetDetails';
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
import { Label } from "@/components/ui/label";

const logger = new Logger('AssetInfoCard');

interface AssetInfoCardProps {
  asset: AnyAsset | null;
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
  curatorProfile?: UserProfile | null;
  isLoadingCuratorProfile?: boolean;
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
  onDetailsUpdated,
  curatorProfile,
  isLoadingCuratorProfile
}: AssetInfoCardProps) => {
  const { user } = useAuth();
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Ref to control EditableLoraDetails actions (e.g., start editing)
  const editableDetailsRef = React.useRef<EditableAssetDetailsHandle>(null);

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

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      toast.error("Failed to copy link.");
      logger.error("Failed to copy link: ", err);
    });
  };

  const assetTypeDisplay = asset?.type ? asset.type.charAt(0).toUpperCase() + asset.type.slice(1) : 'Asset';

  return (
    <div className="md:col-span-1 space-y-4">
      <Card>
        <CardHeader className="pb-2 flex items-start justify-between">
          <CardTitle>{assetTypeDisplay} Information</CardTitle>
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
          <EditableAssetDetails 
            ref={editableDetailsRef}
            asset={asset}
            isAuthorized={isAuthorizedToEdit}
            onDetailsUpdated={onDetailsUpdated}
            hideEditButton
            curatorProfile={curatorProfile}
            isLoadingCuratorProfile={isLoadingCuratorProfile}
          />
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4 border-t pt-4">
          {/* Links Section */}
          {( (asset?.type === 'lora' && (asset as LoraAsset).lora_link) || asset?.download_link) && (
            <div className="flex w-full gap-2">
              {/* External Link Button - LoRA specific */}
              {asset?.type === 'lora' && (asset as LoraAsset).lora_link && (
                <a
                  href={(asset as LoraAsset).lora_link!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'outline' }), "gap-2", asset?.download_link ? "w-1/2" : "w-full")}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden xl:inline">View Source</span>
                </a>
              )}

              {/* Download Link Button - Common, but behavior differs */}
              {asset?.download_link && (
                asset.type === 'workflow' ? (
                  <a
                    href={asset.download_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className={cn(buttonVariants({ variant: 'default' }), "gap-2", (asset as LoraAsset).lora_link && asset.type === 'lora' ? "w-1/2" : "w-full")}
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden xl:inline">Download Workflow</span>
                  </a>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleCopyLink(asset.download_link!)}
                    className={cn("gap-2", (asset as LoraAsset).lora_link ? "w-1/2" : "w-full")}
                    disabled={copied}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    {copied ? (<span className="hidden xl:inline">Copied!</span>) : (<span className="hidden xl:inline">Copy Download</span>)}
                  </Button>
                )
              )}
            </div>
          )}

          {/* User Status Buttons (Owner/Admin Only) */}
          {isAuthorized && (
            <div className="grid grid-cols-3 gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => handleStatusClick('Hidden')} disabled={isUpdatingStatus} className={getStatusButtonStyle('Hidden')}><EyeOff className="h-3 w-3 mr-1" /> <span className="hidden xl:inline">Hide</span></Button>
              <Button variant="outline" size="sm" onClick={() => handleStatusClick('Listed')} disabled={isUpdatingStatus} className={getStatusButtonStyle('Listed')}><List className="h-3 w-3 mr-1" /> <span className="hidden xl:inline">List</span></Button>
              <Button variant="outline" size="sm" onClick={() => handleStatusClick('Pinned')} disabled={isUpdatingStatus} className={getStatusButtonStyle('Pinned')}><PinIcon className="h-3 w-3 mr-1" /> <span className="hidden xl:inline">Pin</span></Button>
            </div>
          )}
          
          {/* Admin Section */}
          {isAdmin && (
            <>
              {isAuthorized && <hr className="w-full my-2" />} 
              <div className="w-full p-3 border border-yellow-500 rounded-md bg-yellow-50/50 space-y-3">
                <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">Admin Controls</p>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button size="sm" variant={asset?.admin_status === 'Hidden' ? "secondary" : "outline"} onClick={() => onAdminStatusChange('Hidden')} className="gap-1 h-8 text-xs" disabled={isUpdatingAdminStatus || asset?.admin_status === 'Hidden'}><EyeOff className="h-4 w-4" /><span className="hidden xl:inline">Hide</span></Button>
                  <Button size="sm" variant={asset?.admin_status === 'Listed' ? "secondary" : "outline"} onClick={() => onAdminStatusChange('Listed')} className="gap-1 h-8 text-xs" disabled={isUpdatingAdminStatus || asset?.admin_status === 'Listed'}><List className="h-4 w-4" /><span className="hidden xl:inline">List</span></Button>
                  <Button size="sm" variant={asset?.admin_status === 'Curated' ? "secondary" : "outline"} onClick={() => onAdminStatusChange('Curated')} className="gap-1 h-8 text-xs" disabled={isUpdatingAdminStatus || asset?.admin_status === 'Curated'}><ListChecks className="h-4 w-4" /><span className="hidden xl:inline">Curate</span></Button>
                  <Button size="sm" variant={asset?.admin_status === 'Featured' ? "secondary" : "outline"} onClick={() => onAdminStatusChange('Featured')} className="gap-1 h-8 text-xs" disabled={isUpdatingAdminStatus || asset?.admin_status === 'Featured'}><Flame className="h-4 w-4" /><span className="hidden xl:inline">Feature</span></Button>
                </div>
              </div>
            </>
          )}

          {/* Delete Button */}
          {isAuthorized && (
             <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full gap-2 mt-2 h-8 text-xs" disabled={isDeleting}>
                    <Trash className="h-4 w-4" />
                    {isDeleting ? 'Deleting...' : `Delete ${assetTypeDisplay}`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the {assetTypeDisplay.toLowerCase()} asset
                      and all associated videos/data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
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
