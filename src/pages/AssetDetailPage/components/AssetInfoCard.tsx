
import React from 'react';
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
  ExternalLink
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoraAsset } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import EditableLoraDescription from '@/components/lora/EditableLoraDescription';

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

const AssetInfoCard: React.FC<AssetInfoCardProps> = ({
  asset,
  creatorDisplayName,
  isAdmin,
  isApproving,
  handleCurateAsset,
  handleListAsset,
  handleRejectAsset,
  getCreatorName
}) => {
  const { user } = useAuth();
  
  // Check if current user is authorized to edit (admin or original uploader)
  const isAuthorizedToEdit = isAdmin || (user && asset?.user_id === user.id);
  
  const handleDescriptionUpdated = (newDescription: string) => {
    if (asset) {
      asset.description = newDescription;
    }
  };
  
  if (!asset) return null;
  
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
  
  const getStatusColor = (status: string | null): string => {
    switch (status) {
      case 'Curated':
        return "bg-green-500 text-white";
      case 'Listed':
        return "bg-blue-500 text-white";
      case 'Rejected':
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };
  
  return (
    <div className="md:col-span-1 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>LoRA Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Description</h3>
            <EditableLoraDescription 
              asset={asset} 
              isAuthorized={isAuthorizedToEdit}
              onDescriptionUpdated={handleDescriptionUpdated}
            />
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-1">Creator</h3>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{getCreatorName()}</span>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-1">Created</h3>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{new Date(asset.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {asset.lora_type && (
              <div>
                <Badge variant="outline" className="bg-background">
                  Type: {asset.lora_type}
                </Badge>
              </div>
            )}
            
            {asset.lora_base_model && (
              <div>
                <Badge 
                  variant="model" 
                  className={cn(getModelColor(asset.lora_base_model))}
                >
                  {asset.lora_base_model.toUpperCase()}
                </Badge>
              </div>
            )}
            
            <div>
              <Badge 
                variant="model" 
                className={cn(getStatusColor(asset.admin_approved))}
              >
                {asset.admin_approved || 'Pending'}
              </Badge>
            </div>
          </div>

          {asset.lora_link && (
            <div>
              <h3 className="text-sm font-medium mb-1">External Link</h3>
              <a 
                href={asset.lora_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View on external site
              </a>
            </div>
          )}
        </CardContent>
        
        {isAdmin && (
          <CardFooter className="flex flex-col gap-2 border-t pt-4">
            <h3 className="text-sm font-medium mb-1 w-full">Admin Actions</h3>
            <div className="grid grid-cols-3 gap-2 w-full">
              <Button 
                onClick={handleCurateAsset} 
                variant="outline" 
                size="sm"
                disabled={isApproving}
                className={cn(
                  "text-xs h-8",
                  asset.admin_approved === 'Curated' && "bg-green-500 text-white hover:bg-green-600"
                )}
              >
                <Check className="h-3 w-3 mr-1" />
                Curate
              </Button>
              
              <Button 
                onClick={handleListAsset} 
                variant="outline" 
                size="sm"
                disabled={isApproving}
                className={cn(
                  "text-xs h-8",
                  asset.admin_approved === 'Listed' && "bg-blue-500 text-white hover:bg-blue-600"
                )}
              >
                List
              </Button>
              
              <Button 
                onClick={handleRejectAsset} 
                variant="outline" 
                size="sm"
                disabled={isApproving}
                className={cn(
                  "text-xs h-8",
                  asset.admin_approved === 'Rejected' && "bg-red-500 text-white hover:bg-red-600"
                )}
              >
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default AssetInfoCard;
