import React, { useState, useEffect } from 'react';
import Masonry from 'react-masonry-css';
import { LoraAsset } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { FileVideo } from 'lucide-react';
import LoraCard from './LoraCard';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const logger = new Logger('LoraList');

interface LoraListProps {
  loras: LoraAsset[];
  initialModelFilter?: string;
}

const LoraList: React.FC<LoraListProps> = ({ loras }) => {
  const { isAdmin } = useAuth();
  
  useEffect(() => {
    logger.log("LoraList received loras:", loras?.length || 0);
  }, [loras]);

  const breakpointColumnsObj = {
    default: 3,
    1024: 2,
    640: 1
  };

  return (
    <div className="flex-1 overflow-auto">
      {loras.length > 0 ? (
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="my-masonry-grid flex w-auto -ml-4"
          columnClassName="my-masonry-grid_column pl-4 bg-clip-padding"
        >
          {loras.map((lora) => (
            <div key={lora.id} className="mb-4">
              <LoraCard 
                lora={lora} 
                isAdmin={isAdmin} 
              />
            </div>
          ))}
        </Masonry>
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
  );
};

export default LoraList;
