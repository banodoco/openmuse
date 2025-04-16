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

const LoraList: React.FC<LoraListProps> = ({ loras, initialModelFilter = 'all' }) => {
  const [filterText, setFilterText] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('curated'); // Default to 'curated'
  const [modelFilter, setModelFilter] = useState(initialModelFilter); // Use the initialModelFilter
  const { user, isAdmin } = useAuth();
  const adminCheckComplete = React.useRef(false);
  
  useEffect(() => {
    logger.log("LoraList received loras:", loras?.length || 0);
  }, [loras]);
  
  // Update modelFilter when initialModelFilter changes (e.g., from URL)
  useEffect(() => {
    setModelFilter(initialModelFilter);
  }, [initialModelFilter]);
  
  // Get unique models from loras
  const uniqueModels = React.useMemo(() => {
    const models = new Set<string>();
    loras?.forEach(lora => {
      if (lora.lora_base_model) {
        models.add(lora.lora_base_model.toLowerCase());
      }
    });
    return Array.from(models).sort();
  }, [loras]);
  
  const filteredLoras = (loras || []).filter(lora => {
    const searchTerm = filterText.toLowerCase();
    const matchesText = (
      ((lora.name || '').toLowerCase().includes(searchTerm)) ||
      ((lora.description || '').toLowerCase().includes(searchTerm)) ||
      ((lora.creator || '').toLowerCase().includes(searchTerm))
    );
    
    // Model filter
    const matchesModel = modelFilter === 'all' || 
      (lora.lora_base_model && lora.lora_base_model.toLowerCase() === modelFilter.toLowerCase());
    
    let matchesApproval = false;
    const loraApproved = lora.admin_approved;
    const videoApproved = lora.primaryVideo?.admin_approved;
    
    if (approvalFilter === 'curated') {
      // Primarily check the LoRA's status. 
      matchesApproval = loraApproved === 'Curated';
      // If LoRA isn't 'Curated' but video exists and IS 'Curated', also match.
      if (!matchesApproval && videoApproved === 'Curated') {
          matchesApproval = true;
      }
    } else if (approvalFilter === 'listed') {
      matchesApproval = (!loraApproved || loraApproved === 'Listed' || !videoApproved || videoApproved === 'Listed') 
                      && loraApproved !== 'Rejected' && videoApproved !== 'Rejected';
    } else if (approvalFilter === 'rejected') {
      matchesApproval = loraApproved === 'Rejected' || videoApproved === 'Rejected';
    }
    
    return matchesText && matchesApproval && matchesModel;
  });

  const getFilterButtonClass = (filter: string) => {
    return cn(
      "px-4 py-2 rounded-md text-sm font-medium transition-colors",
      approvalFilter === filter 
        ? "!bg-[#FEF7CD] !text-forest-dark hover:!bg-[#FEF7CD]" 
        : "bg-muted hover:bg-muted/80"
    );
  };

  // Format model name for display
  const formatModelName = (model: string) => {
    switch (model.toLowerCase()) {
      case 'wan': return 'Wan';
      case 'hunyuan': return 'Hunyuan';
      case 'ltxv': return 'LTXV';
      case 'cogvideox': return 'CogVideoX';
      case 'animatediff': return 'Animatediff';
      default: return model.charAt(0).toUpperCase() + model.slice(1);
    }
  };

  // Handle model filter change with URL update
  const handleModelFilterChange = (value: string) => {
    setModelFilter(value);
    
    // Update URL with the model filter
    const url = new URL(window.location.href);
    if (value === 'all') {
      url.searchParams.delete('model');
    } else {
      url.searchParams.set('model', value);
    }
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-1 gap-4">
          <Input
            type="text"
            placeholder="Filter LoRAs..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="max-w-sm"
          />
          
          <Select
            value={modelFilter}
            onValueChange={handleModelFilterChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {uniqueModels.map(model => (
                <SelectItem key={model} value={model}>
                  {formatModelName(model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex gap-2 mb-4">
        <Button
          type="button"
          onClick={() => setApprovalFilter('curated')}
          className={getFilterButtonClass('curated')}
          style={{
            backgroundColor: approvalFilter === 'curated' ? '#FEF7CD' : '',
            color: approvalFilter === 'curated' ? '#1A2D10' : ''
          }}
          variant="outline"
        >
          Curated
        </Button>
        <Button
          type="button"
          onClick={() => setApprovalFilter('listed')}
          className={getFilterButtonClass('listed')}
          style={{
            backgroundColor: approvalFilter === 'listed' ? '#FEF7CD' : '',
            color: approvalFilter === 'listed' ? '#1A2D10' : ''
          }}
          variant="outline"
        >
          Listed
        </Button>
        {isAdmin && (
          <Button
            type="button"
            onClick={() => setApprovalFilter('rejected')}
            className={getFilterButtonClass('rejected')}
            style={{
              backgroundColor: approvalFilter === 'rejected' ? '#FEF7CD' : '',
              color: approvalFilter === 'rejected' ? '#1A2D10' : ''
            }}
            variant="outline"
          >
            Rejected
          </Button>
        )}
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredLoras.length > 0 ? (
            filteredLoras.map((lora) => (
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
                {filterText || approvalFilter !== 'curated' || modelFilter !== 'all'
                  ? "Try different filter settings" 
                  : "Upload some LoRAs to get started"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoraList;
