import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('LoraManager');
logger.log('LoraManager component module loaded');

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading?: boolean;
  modelFilter?: string;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false,
  modelFilter = 'all'
}) => {
  // Removed useAuth() call as it's not directly used for rendering logic here
  // const { user, isAdmin } = useAuth(); 
  logger.log(`LoraManager rendering/initializing. Props: isLoading=${isLoading}, loras count=${loras?.length || 0}, modelFilter=${modelFilter}`);

  if (isLoading) {
    logger.log('LoraManager: isLoading is true, rendering LoadingState.');
    return <LoadingState />;
  }

  if (!loras || loras.length === 0) {
    logger.log('LoraManager: No loras available, rendering EmptyState.');
    return (
      <EmptyState 
        title="No LoRAs Available" 
        description="There are currently no LoRAs in the collection. Upload a new LoRA to get started!" 
      />
    );
  }

  logger.log(`LoraManager: Rendering LoraList with ${loras.length} loras, initial filter: ${modelFilter}`);
  // Pass isAdmin down to LoraList if needed for filtering controls there
  // const { isAdmin } = useAuth(); // If needed, re-add useAuth here
  return <LoraList loras={loras} initialModelFilter={modelFilter} /* isAdmin={isAdmin} */ />;
};

export default LoraManager;
