
import React, { useEffect } from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { Logger } from '@/lib/logger';

const logger = new Logger('LoraManager');

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading?: boolean;
  showExtras?: boolean;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false,
  showExtras = false  // Changed default to false
}) => {
  useEffect(() => {
    logger.log(`LoraManager initialized with showExtras: ${showExtras}`);
  }, [showExtras]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (!loras || loras.length === 0) {
    return (
      <EmptyState 
        title="No LoRAs Available" 
        description="There are currently no LoRAs in the collection. Upload a new LoRA to get started!" 
      />
    );
  }

  logger.log(`LoraManager rendering with showExtras: ${showExtras}`);
  return <LoraList loras={loras} showExtras={showExtras} />;
};

export default LoraManager;
