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
  ExternalLink
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoraAsset } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import EditableLoraDetails from '@/components/lora/EditableLoraDetails';

interface AssetInfoCardProps {
  asset: LoraAsset | null;
  creatorDisplayName: string | null;
  isAdmin: boolean | undefined;
  isApproving: boolean;
  handleCurateAsset: () => Promise<void>;
  handleListAsset: () => Promise<void>;
  handleRejectAsset: () => Promise<void>;
  getCreatorName: () => string;
}

const AssetInfoCard = ({
  asset,
  creatorDisplayName,
  isAdmin,
  isApproving,
  handleCurateAsset,
  handleListAsset,
  handleRejectAsset,
  getCreatorName
}: AssetInfoCardProps) => {
  const { user } = useAuth();
  const isAuthorizedToEdit = isAdmin || user?.id === asset?.user_id;

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
          
          <div className="flex flex-wrap gap-2">
            {asset?.lora_type && (
              <div>
                <div className={cn(badgeVariants({ variant: "outline" }))}>
                  Type: {asset.lora_type}
                </div>
              </div>
            )}
            
            {asset?.lora_base_model && (
              <div>
                <div className={cn(badgeVariants({ variant: "default" }), getModelColor(asset.lora_base_model))}>
                  {asset.lora_base_model.toUpperCase()}
                </div>
              </div>
            )}
            
            <div>
              <div className={cn(badgeVariants({ variant: "default" }), getStatusColor(asset.admin_approved))}>
                {asset.admin_approved || 'Pending'}
              </div>
            </div>
          </div>
        </CardContent>
        
        {isAdmin && (
          <CardFooter className="flex flex-col gap-2">
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
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default AssetInfoCard;
