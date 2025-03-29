
import React from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoraAsset } from '@/lib/types';
import { toast } from 'sonner';

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

  return (
    <Card className="md:col-span-1">
      <CardHeader>
        <CardTitle>{asset?.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
        
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
          <p>{asset?.created_at ? new Date(asset.created_at).toLocaleDateString() : 'Unknown'}</p>
        </div>
        
        {asset?.lora_link && (
          <Button 
            variant="default" // Changed from "outline" to "default"
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
