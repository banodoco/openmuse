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
  currentUserPreference: UserAssetPreferenceStatus | null;
  onPreferenceChange: (newStatus: UserAssetPreferenceStatus) => void;
}

const AssetInfoCard = ({
  asset,
  isAuthorizedToEdit,
  userIsLoggedIn,
  currentUserPreference,
  onPreferenceChange
}: AssetInfoCardProps) => {
  const { user } = useAuth();
  const [isUpdatingPreference, setIsUpdatingPreference] = React.useState(false);

  const handlePreferenceClick = async (newStatus: UserAssetPreferenceStatus) => {
    if (!onPreferenceChange || !userIsLoggedIn) return;
    
    setIsUpdatingPreference(true);
    try {
      await onPreferenceChange(newStatus);
    } catch (error) {
      logger.error("[AssetInfoCard] Preference change failed:", error);
    } finally {
      setIsUpdatingPreference(false);
    }
  };

  const getPreferenceButtonStyle = (status: UserAssetPreferenceStatus) => {
    const isActive = currentUserPreference === status;
    return cn(
      "text-xs h-8 flex-1",
      isActive && status === 'Pinned' && "bg-green-500 text-white hover:bg-green-600",
      isActive && status === 'Listed' && "bg-blue-500 text-white hover:bg-blue-600",
      isActive && status === 'Hidden' && "bg-gray-500 text-white hover:bg-gray-600",
      !isActive && "bg-transparent"
    );
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
        
        <CardFooter className="flex flex-col gap-2 border-t pt-4">
          {/* External Link Button */}
          {asset?.lora_link && (
            <a 
              href={asset.lora_link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants(), "w-full gap-2 mb-2")}
            > 
              <ExternalLink className="h-4 w-4" />
              View External Link
            </a>
          )}

          {/* User Preference Buttons - Show only if user is logged in */}
          {userIsLoggedIn && (
            <div className="grid grid-cols-3 gap-2 w-full border-t pt-4 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePreferenceClick('Pinned')}
                disabled={isUpdatingPreference}
                className={getPreferenceButtonStyle('Pinned')}
              >
                <PinIcon className="h-3 w-3 mr-1" /> 
                Pin
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePreferenceClick('Listed')}
                disabled={isUpdatingPreference}
                className={getPreferenceButtonStyle('Listed')}
              >
                <List className="h-3 w-3 mr-1" />
                List
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePreferenceClick('Hidden')}
                disabled={isUpdatingPreference}
                className={getPreferenceButtonStyle('Hidden')}
              >
                <EyeOff className="h-3 w-3 mr-1" /> 
                Hide
              </Button>
            </div>
          )}
          
        </CardFooter>
      </Card>
    </div>
  );
};

export default AssetInfoCard;
