import React, { useState, useEffect } from 'react';
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
