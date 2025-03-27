
import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
  refetchLoras: () => Promise<void>;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras,
  isLoading,
  refetchLoras
}) => {
  return (
    <div className="mt-6">
      {isLoading ? (
        <LoadingState />
      ) : (
        <LoraList loras={loras} onRefresh={refetchLoras} />
      )}
    </div>
  );
};

export default LoraManager;
