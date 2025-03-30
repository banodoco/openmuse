
import React from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoraAsset } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AssetInfoCardProps {
  asset: LoraAsset | null;
  creatorDisplayName: string | null;
  isAdmin: boolean;
  authChecked: boolean;
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
  authChecked,
  isApproving,
  handleCurateAsset,
  handleListAsset,
  handleRejectAsset,
  getCreatorName
}) => {
  const handleDownloadLora = () => {
    if (asset?.lora_link) {
      window.open(asset.lora_link, '_blank');
      toast.success('Opening LoRA download link');
    } else {
      toast.error('No download link available');
    }
  };

  const getModelColor = (modelType?: string): string => {
    switch (modelType?.toLowerCase()) {
      case 'wan':
        return "bg-blue-500";
      case 'hunyuan':
        return "bg-purple-500";
      case 'ltxv':
        return "bg-amber-500";
      case 'cogvideox':
        return "bg-emerald-500";
      case 'animatediff':
        return "bg-pink-500";
      default:
        return "bg-gray-500";
    }
  };

  // Get base model name with fallbacks
  const getModelName = (): string | undefined => {
    // First priority: asset's lora_base_model
    if (asset?.lora_base_model) {
      return asset.lora_base_model;
    }
    // Second priority: primaryVideo metadata model
    else if (asset?.primaryVideo?.metadata?.model) {
      return asset.primaryVideo.metadata.model;
    }
    return undefined;
  };

  // Get LoRA type with fallbacks
  const getLoraType = (): string | undefined => {
    // First priority: asset's lora_type
    if (asset?.lora_type) {
      return asset.lora_type;
    }
    // Second priority: primaryVideo metadata loraType
    else if (asset?.primaryVideo?.metadata?.loraType) {
      return asset.primaryVideo.metadata.loraType;
    }
    return undefined;
  };

  const modelName = getModelName();
  const loraType = getLoraType();

  return (
    <Card className="md:col-span-1">
      <CardContent className="space-y-4 pt-6">
        {asset?.description && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
            <p>{asset.description}</p>
          </div>
        )}
        
        {(asset?.creator || creatorDisplayName) && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Creator</h3>
            <p>{getCreatorName()}</p>
          </div>
        )}
        
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Type</h3>
          <Badge variant="outline">{asset?.type}</Badge>
        </div>

        {modelName && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Base Model</h3>
            <Badge 
              variant="model" 
              className={cn("text-white", getModelColor(modelName))}
            >
              {modelName.toUpperCase()}
            </Badge>
          </div>
        )}

        {loraType && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">LoRA Type</h3>
            <Badge variant="outline">{loraType}</Badge>
          </div>
        )}
        
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
          <p>{asset?.created_at ? new Date(asset.created_at).toLocaleDateString() : 'Unknown'}</p>
        </div>

        {asset?.primaryVideo?.metadata?.baseModel && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Additional Model Info</h3>
            <p>{asset.primaryVideo.metadata.baseModel}</p>
          </div>
        )}

        {asset?.primaryVideo?.metadata?.trainingSteps && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Training Steps</h3>
            <p>{asset.primaryVideo.metadata.trainingSteps}</p>
          </div>
        )}

        {asset?.primaryVideo?.metadata?.resolution && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Resolution</h3>
            <p>{asset.primaryVideo.metadata.resolution}</p>
          </div>
        )}

        {asset?.primaryVideo?.metadata?.trainingDataset && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Training Dataset</h3>
            <p>{asset.primaryVideo.metadata.trainingDataset}</p>
          </div>
        )}

        {asset?.admin_approved && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
            <Badge 
              className={cn(
                asset.admin_approved === 'Curated' && "bg-green-500 text-white",
                asset.admin_approved === 'Listed' && "bg-blue-500 text-white",
                asset.admin_approved === 'Rejected' && "bg-red-500 text-white",
              )}
            >
              {asset.admin_approved}
            </Badge>
          </div>
        )}
        
        {asset?.lora_link && (
          <Button 
            variant="default"
            size="sm" 
            className="w-full gap-2 mt-2"
            onClick={handleDownloadLora}
          >
            <Download className="h-4 w-4" />
            Download LoRA
          </Button>
        )}
      </CardContent>
      {isAdmin && authChecked && (
        <CardFooter className="flex-col items-stretch space-y-2">
          <div className="text-sm font-medium text-muted-foreground mb-2">Admin Actions</div>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant={asset?.admin_approved === 'Curated' ? "default" : "outline"}
              className="flex-1 gap-1"
              onClick={handleCurateAsset}
              disabled={isApproving}
            >
              <Check className="h-4 w-4" />
              Curate
            </Button>
            
            <Button 
              variant={asset?.admin_approved === 'Listed' ? "default" : "outline"}
              className="flex-1 gap-1"
              onClick={handleListAsset}
              disabled={isApproving}
            >
              List
            </Button>
            
            <Button 
              variant={asset?.admin_approved === 'Rejected' ? "destructive" : "outline"}
              className="flex-1 gap-1"
              onClick={handleRejectAsset}
              disabled={isApproving}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default AssetInfoCard;
