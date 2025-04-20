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
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetHeader;
