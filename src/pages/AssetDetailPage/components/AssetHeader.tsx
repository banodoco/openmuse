
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LoraAsset } from '@/lib/types';

interface AssetHeaderProps {
  asset: LoraAsset | null;
  handleGoBack: () => void;
}

const AssetHeader: React.FC<AssetHeaderProps> = ({ asset, handleGoBack }) => {
  return (
    <div className="mb-6 flex items-center">
      <Button 
        variant="outline" 
        onClick={handleGoBack}
        className="mr-4 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <h1 className="text-3xl font-bold">{asset?.name}</h1>
    </div>
  );
};

export default AssetHeader;
