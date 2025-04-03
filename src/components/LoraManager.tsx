import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('LoraManager');

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading?: boolean;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false
}) => {
  const { user, isAdmin } = useAuth();
  logger.log("LoraManager initialized.");

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

  logger.log(`LoraManager rendering.`);
  return <LoraList loras={loras} />;
};

export default LoraManager;
