
import React from 'react';
import { LoraAsset } from '@/lib/types';
import LoraCard from './LoraCard';

interface LoraListProps {
  loras: LoraAsset[];
  showExtras?: boolean;
  showPlayButtonOnMobile?: boolean;
}

const LoraList: React.FC<LoraListProps> = ({ 
  loras, 
  showExtras = false,
  showPlayButtonOnMobile = true,
}) => {
  if (!loras || loras.length === 0) {
    return (
      <div className="text-center p-8 bg-muted rounded-lg">
        <p>No LoRAs available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {loras.map((lora) => (
        <LoraCard 
          key={lora.id} 
          lora={lora} 
          showExtras={showExtras}
          showPlayButtonOnMobile={showPlayButtonOnMobile}
        />
      ))}
    </div>
  );
};

export default LoraList;
