import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';

const logger = new Logger('LoraFilters');

interface LoraFiltersProps {
  filterText: string;
  onFilterTextChange: (value: string) => void;
  modelFilter: string;
  onModelFilterChange: (value: string) => void;
  uniqueModels: string[];
  isLoading?: boolean;
  isAdmin?: boolean;
}

export const LoraFilters: React.FC<LoraFiltersProps> = ({
  filterText,
  onFilterTextChange,
  modelFilter,
  onModelFilterChange,
  uniqueModels,
  isLoading = false,
  isAdmin = false,
}) => {
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

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-1 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-[200px]" /> {/* Search input skeleton */}
              <Skeleton className="h-10 w-[180px]" /> {/* Model filter skeleton */}
            </>
          ) : (
            <>
              <Input
                type="text"
                placeholder="Filter LoRAs..."
                value={filterText}
                onChange={(e) => onFilterTextChange(e.target.value)}
                className="max-w-sm"
              />
              
              <Select
                value={modelFilter}
                onValueChange={onModelFilterChange}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 