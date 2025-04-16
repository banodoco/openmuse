import React, { useEffect } from 'react';
import { LoraAsset } from '@/lib/types';
import { FileVideo } from 'lucide-react';
import LoraCard from './LoraCard';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('LoraList');

interface LoraListProps {
  loras: LoraAsset[];
}

const LoraList: React.FC<LoraListProps> = ({ loras }) => {
  const { isAdmin } = useAuth();
  
  useEffect(() => {
    logger.log("LoraList received loras:", loras?.length || 0);
  }, [loras]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {loras.length > 0 ? (
          loras.map((lora) => (
            <LoraCard 
              key={lora.id} 
              lora={lora} 
              isAdmin={isAdmin} 
            />
          ))
        ) : (
          <div className="col-span-full text-center py-8">
            <FileVideo className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium">No LoRAs found</h3>
            <p className="text-muted-foreground">
              Try different filter settings
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoraList;
