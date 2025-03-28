
import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraCard from './LoraCard';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Info } from 'lucide-react';
import { Logger } from '@/lib/logger';

const logger = new Logger('LoraList');

interface LoraListProps {
  loras: LoraAsset[];
  onRefresh?: () => Promise<void>;
}

const LoraList: React.FC<LoraListProps> = ({ loras, onRefresh }) => {
  if (!loras || loras.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No LoRAs available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 p-4">
      {loras.map((lora) => (
        <div key={lora.id} className="relative h-full">
          <LoraCard lora={lora} />
        </div>
      ))}
    </div>
  );
};

export default LoraList;
