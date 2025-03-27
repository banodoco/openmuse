
import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import { Skeleton } from '@/components/ui/skeleton';

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
  refetchLoras: () => void;
}

const LoraManager: React.FC<LoraManagerProps> = ({
  loras,
  isLoading,
  refetchLoras
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4 mt-8">
        <Skeleton className="h-10 w-[200px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="mt-8">
      <LoraList loras={loras} />
    </div>
  );
};

export default LoraManager;
