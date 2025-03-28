
import React, { useState } from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import { Button } from './ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
  refetchLoras: () => void;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading,
  refetchLoras
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchLoras();
    setIsRefreshing(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold tracking-tight">Available LoRAs</h2>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm" 
          disabled={isRefreshing || isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>
      
      <div className="mb-12">
        <LoraList 
          loras={loras} 
          isLoading={isLoading} 
        />
      </div>
    </div>
  );
};

export default LoraManager;
