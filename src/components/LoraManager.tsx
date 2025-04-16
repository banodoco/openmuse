import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { Logger } from '@/lib/logger';
import { LoraGallerySkeleton } from './LoraGallerySkeleton';

const logger = new Logger('LoraManager');
logger.log('LoraManager component module loaded');

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading?: boolean;
  lorasAreLoading?: boolean;
  modelFilter?: string;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false,
  lorasAreLoading = false,
  modelFilter = 'all'
}) => {
  logger.log(`LoraManager rendering/initializing. Props: isLoading (videos)=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, modelFilter=${modelFilter}`);

  if (isLoading) {
    logger.log('LoraManager: isLoading (videos) is true, rendering LoadingState.');
    return <LoadingState />;
  }

  if (lorasAreLoading) {
    logger.log('LoraManager: Videos loaded, but lorasAreLoading is true, rendering LoraGallerySkeleton.');
    return <LoraGallerySkeleton count={6} />;
  }

  if (!loras || loras.length === 0) {
    logger.log('LoraManager: Videos & LoRAs loaded, but no loras available, rendering EmptyState.');
    return (
      <EmptyState 
        title="No LoRAs Available" 
        description="There are currently no LoRAs in the collection that match your filters. Upload a new LoRA or adjust filters!" 
      />
    );
  }

  logger.log(`LoraManager: Rendering LoraList with ${loras.length} loras, initial filter: ${modelFilter}`);
  return <LoraList loras={loras} initialModelFilter={modelFilter} />;
};

export default LoraManager;
