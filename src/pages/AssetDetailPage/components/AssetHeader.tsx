import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, EyeOff, Trash } from 'lucide-react';
import { LoraAsset } from '@/lib/types';
import { useNavigate } from 'react-router-dom';
import { Logger } from '@/lib/logger';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

const logger = new Logger('AssetHeader');

interface AssetHeaderProps {
  asset: LoraAsset | null;
  // Add new props for creator name and admin actions
  creatorName: string;
  isAdmin: boolean;
  isAuthorized: boolean; // For delete button visibility
  isApproving: boolean;
  onCurate: () => Promise<void>;
  onList: () => Promise<void>;
  onReject: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const AssetHeader: React.FC<AssetHeaderProps> = ({
  asset,
  // Destructure new props
  creatorName,
  isAdmin,
  isAuthorized,
  isApproving,
  onCurate,
  onList,
  onReject,
  onDelete
}) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = React.useState(false); // State for delete confirmation

  const handleGoBack = () => {
    navigate(-1); // Simplify: just go back
  };
  
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      // Navigate away after successful deletion (e.g., to user profile or home)
      navigate(`/profile/${creatorName}`); // Example: navigate to creator's profile
    } catch (error) {
      logger.error("Error during asset deletion confirmation:", error);
      // Error is likely handled and toasted in the parent hook
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status?: string | null): string => {
    switch (status) {
      case 'Curated': return "bg-green-500 text-white";
      case 'Listed': return "bg-blue-500 text-white";
      case 'Rejected': return "bg-red-500 text-white";
      default: return "bg-yellow-500 text-white";
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            onClick={handleGoBack}
            className="mr-4 gap-2"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-col">
             <h1 className="text-3xl font-bold">{asset?.name}</h1>
             <span className="text-sm text-muted-foreground">by {creatorName}</span>
          </div>
        </div>
        {/* Admin Status Badge */}
        {asset?.admin_status && (
           <Badge className={cn("text-xs", getStatusColor(asset.admin_status))}>
             {asset.admin_status}
           </Badge>
        )}
      </div>

      {/* Admin Moderation Buttons & Delete Button */}
      {(isAdmin || isAuthorized) && (
        <div className="flex items-center justify-end gap-2 p-2 border rounded-md bg-muted/30">
          {isAdmin && (
            <>
              <Button
                size="sm"
                onClick={onCurate}
                className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={isApproving || asset?.admin_status === 'Curated'}
              >
                <Check className="h-4 w-4" /> Curate
              </Button>
              <Button
                size="sm"
                onClick={onList}
                variant="secondary"
                className="gap-1"
                disabled={isApproving || asset?.admin_status === 'Listed'}
              >
                <Check className="h-4 w-4" /> List
              </Button>
              <Button
                size="sm"
                onClick={onReject}
                variant="outline"
                className={cn(
                  "gap-1",
                  "border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700",
                  (isApproving || asset?.admin_status === 'Rejected') && "bg-orange-100 opacity-70 cursor-not-allowed"
                )}
                disabled={isApproving || asset?.admin_status === 'Rejected'}
              >
                <EyeOff className="h-4 w-4" /> Hide
              </Button>
              <div className="border-l h-6 mx-2"></div> {/* Separator */}
            </>
          )}

          {/* Delete Button - Visible to Admin OR Asset Owner */}
          {isAuthorized && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1"
                  disabled={isDeleting}
                >
                  <Trash className="h-4 w-4" /> 
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
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
        </div>
      )}
    </div>
  );
};

export default AssetHeader;
