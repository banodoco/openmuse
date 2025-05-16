import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AnyAsset } from '@/lib/types';
import { useNavigate } from 'react-router-dom';

interface AssetHeaderProps {
  asset: AnyAsset | null;
  creatorName: string;
}

const AssetHeader: React.FC<AssetHeaderProps> = ({
  asset,
  creatorName,
}) => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
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
             {asset?.type && (
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {asset.type}
                </span>
             )}
             <h1 className="text-3xl font-bold">{asset?.name || 'Asset Details'}</h1>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetHeader;
