
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoraAsset } from '@/lib/types';

interface AssetHeaderProps {
  asset: LoraAsset | null;
  handleGoBack: () => void;
}

const AssetHeader: React.FC<AssetHeaderProps> = ({ asset, handleGoBack }) => {
  const getApprovalStatusBadge = () => {
    if (!asset) return null;
    
    switch (asset.admin_approved) {
      case 'Curated':
        return <Badge className="bg-green-500">Curated</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      case 'Listed':
      default:
        return <Badge variant="outline">Listed</Badge>;
    }
  };

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
      <div className="ml-3">{getApprovalStatusBadge()}</div>
    </div>
  );
};

export default AssetHeader;
