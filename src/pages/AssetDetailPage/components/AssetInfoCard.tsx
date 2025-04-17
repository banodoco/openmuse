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
import { Button, buttonVariants } from "@/components/ui/button";
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
        </CardContent>
        
        {asset?.lora_link && (
          <CardFooter className="pt-0 border-t">
            <a 
              href={asset.lora_link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants(), "w-full mt-4")}
            > 
              <ExternalLink className="h-4 w-4 mr-2" />
              View External Link
            </a>
          </CardFooter>
        )}

        {isAdmin && (
          <CardFooter className="flex flex-col gap-2 border-t pt-4">
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
