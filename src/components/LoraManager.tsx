
import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
  showExtras?: boolean;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras,
  isLoading,
  showExtras = false,
}) => {
  // Ensure loras is always an array
  const safeLoraList = Array.isArray(loras) ? loras : [];
  
  return (
    <div className="mt-6">
      {isLoading ? (
        <LoadingState text="Loading LoRAs..." />
      ) : (
        <LoraList loras={safeLoraList} showExtras={showExtras} />
      )}
    </div>
  );
};

export default LoraManager;
