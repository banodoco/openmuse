
import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading?: boolean;
  showExtras?: boolean;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false,
  showExtras = true  // Make sure this is correctly passed down
}) => {
  if (isLoading) {
    return <LoadingState />;
  }

  if (!loras || loras.length === 0) {
    return <EmptyState message="No LoRAs found" />;
  }

  return <LoraList loras={loras} showExtras={showExtras} />;
};

export default LoraManager;
