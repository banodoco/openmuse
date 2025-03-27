
import React from 'react';
import { LoraAsset } from '@/lib/types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from '@/components/ui/input';
import { FileVideo } from 'lucide-react';
import LoraCard from './LoraCard';

interface LoraListProps {
  loras: LoraAsset[];
}

const LoraList: React.FC<LoraListProps> = ({ loras }) => {
  const [filterText, setFilterText] = React.useState('');

  const filteredLoras = loras.filter(lora => {
    const searchTerm = filterText.toLowerCase();
    return (
      lora.name.toLowerCase().includes(searchTerm) ||
      (lora.description?.toLowerCase().includes(searchTerm) ?? false) ||
      (lora.creator?.toLowerCase().includes(searchTerm) ?? false)
    );
  });

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <Input
          type="text"
          placeholder="Filter LoRAs..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLoras.map((lora) => (
            <LoraCard key={lora.id} lora={lora} />
          ))}
          
          {filteredLoras.length === 0 && (
            <div className="col-span-full text-center py-8">
              <FileVideo className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No LoRAs found</h3>
              <p className="text-muted-foreground">
                {filterText ? "Try a different search term" : "Upload some LoRAs to get started"}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LoraList;
