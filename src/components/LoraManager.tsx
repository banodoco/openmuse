import React, { useState, useMemo } from 'react';
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
  modelFilter?: string;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false,
  lorasAreLoading = false,
  modelFilter = 'all'
}) => {
  logger.log(`LoraManager rendering/initializing. Props: isLoading (videos)=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, modelFilter=${modelFilter}`);

  const { isAdmin } = useAuth();
  const [filterText, setFilterText] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('curated');
  const [currentModelFilter, setCurrentModelFilter] = useState(modelFilter);

  // Extract unique models from loras
  const uniqueModels = useMemo(() => {
    if (!loras) return [];
    const models = new Set(loras.map(lora => lora.lora_base_model).filter(Boolean));
    return Array.from(models).sort();
  }, [loras]);

  // Filter loras based on all criteria
  const filteredLoras = useMemo(() => {
    if (!loras) return [];
    
    return loras.filter(lora => {
      const matchesText = !filterText || 
        lora.name?.toLowerCase().includes(filterText.toLowerCase()) ||
        lora.creator?.toLowerCase().includes(filterText.toLowerCase());
        
      const matchesModel = currentModelFilter === 'all' || 
        lora.lora_base_model?.toLowerCase() === currentModelFilter.toLowerCase();
        
      const matchesApproval = approvalFilter === 'all' ||
        (lora.admin_approved || 'Listed').toLowerCase() === approvalFilter.toLowerCase();
        
      return matchesText && matchesModel && matchesApproval;
    });
  }, [loras, filterText, currentModelFilter, approvalFilter]);

  return (
    <div className="space-y-4">
      <LoraFilters
        filterText={filterText}
        onFilterTextChange={setFilterText}
        approvalFilter={approvalFilter}
        onApprovalFilterChange={setApprovalFilter}
        modelFilter={currentModelFilter}
        onModelFilterChange={setCurrentModelFilter}
        uniqueModels={uniqueModels}
        isLoading={isLoading || lorasAreLoading}
        isAdmin={isAdmin}
      />

      {isLoading ? (
        <LoadingState />
      ) : lorasAreLoading ? (
        <LoraGallerySkeleton count={6} />
      ) : !filteredLoras || filteredLoras.length === 0 ? (
        <EmptyState 
          title="No LoRAs Available" 
          description="There are currently no LoRAs in the collection that match your filters. Upload a new LoRA or adjust filters!" 
        />
      ) : (
        <LoraList loras={filteredLoras} />
      )}
    </div>
  );
};

export default LoraManager;
