import React, { useMemo } from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { Logger } from '@/lib/logger';
import { LoraGallerySkeleton } from './LoraGallerySkeleton';
import { LoraFilters } from './lora/LoraFilters';

const logger = new Logger('LoraManager');
logger.log('LoraManager component module loaded');

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading?: boolean;
  lorasAreLoading?: boolean;
  filterText: string;
  onFilterTextChange: (value: string) => void;
  approvalFilter: string;
  onApprovalFilterChange: (value: string) => void;
  modelFilter: string;
  onModelFilterChange: (value: string) => void;
  isAdmin?: boolean;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false,
  lorasAreLoading = false,
  filterText,
  onFilterTextChange,
  approvalFilter,
  onApprovalFilterChange,
  modelFilter,
  onModelFilterChange,
  isAdmin = false
}) => {
  logger.log(`LoraManager rendering/initializing. Props: isLoading=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, modelFilter=${modelFilter}`);

  // Extract unique models from loras (still needed for the filter dropdown)
  const uniqueModels = useMemo(() => {
    if (!loras) return [];
    const models = new Set(loras.map(lora => lora.lora_base_model).filter(Boolean));
    return Array.from(models).sort();
  }, [loras]);

  return (
    <div className="space-y-4">
      <LoraFilters
        filterText={filterText}
        onFilterTextChange={onFilterTextChange}
        approvalFilter={approvalFilter}
        onApprovalFilterChange={onApprovalFilterChange}
        modelFilter={modelFilter}
        onModelFilterChange={onModelFilterChange}
        uniqueModels={uniqueModels}
        isLoading={isLoading || lorasAreLoading}
        isAdmin={isAdmin}
      />

      {isLoading ? (
        <LoadingState />
      ) : lorasAreLoading ? (
        <LoraGallerySkeleton count={6} />
      ) : !loras || loras.length === 0 ? (
        <EmptyState 
          title="No LoRAs Available" 
          description="There are currently no LoRAs in the collection that match your filters. Upload a new LoRA or adjust filters!" 
        />
      ) : (
        <LoraList loras={loras} />
      )}
    </div>
  );
};

export default LoraManager;
