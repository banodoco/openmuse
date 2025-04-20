import React, { useMemo } from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { Logger } from '@/lib/logger';
import { LoraGallerySkeleton } from './LoraGallerySkeleton';
import { LoraFilters } from './lora/LoraFilters';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('LoraManager');
logger.log('LoraManager component module loaded');

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading?: boolean;
  lorasAreLoading?: boolean;
  filterText: string;
  modelFilter: string;
  onFilterTextChange: (value: string) => void;
  onModelFilterChange: (value: string) => void;
  isAdmin?: boolean;
  onNavigateToUpload?: () => void;
  onRefreshData?: () => void;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false,
  lorasAreLoading = false,
  filterText,
  modelFilter,
  onFilterTextChange,
  onModelFilterChange,
  isAdmin,
  onNavigateToUpload,
  onRefreshData,
}) => {
  logger.log(`LoraManager rendering/initializing. Props: isLoading (videos)=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, modelFilter=${modelFilter}, filterText=${filterText}, isAdmin=${isAdmin}`);

  const { isAdmin: authIsAdmin } = useAuth();
  
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
        modelFilter={modelFilter}
        onModelFilterChange={onModelFilterChange}
        uniqueModels={uniqueModels}
        isLoading={isLoading || lorasAreLoading}
        isAdmin={isAdmin || authIsAdmin}
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
