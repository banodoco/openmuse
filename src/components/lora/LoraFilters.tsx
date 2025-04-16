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
  approvalFilter: string;
  onApprovalFilterChange: (value: string) => void;
  modelFilter: string;
  onModelFilterChange: (value: string) => void;
  uniqueModels: string[];
  isLoading?: boolean;
  isAdmin?: boolean;
}

export const LoraFilters: React.FC<LoraFiltersProps> = ({
  filterText,
  onFilterTextChange,
  approvalFilter,
  onApprovalFilterChange,
  modelFilter,
  onModelFilterChange,
  uniqueModels,
  isLoading = false,
  isAdmin = false,
}) => {
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
      
      <div className="flex gap-2 mb-4">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-[100px]" /> {/* Curated button skeleton */}
            <Skeleton className="h-10 w-[100px]" /> {/* Listed button skeleton */}
            {isAdmin && <Skeleton className="h-10 w-[100px]" />} {/* Rejected button skeleton (admin only) */}
          </>
        ) : (
          <>
            <Button
              type="button"
              onClick={() => onApprovalFilterChange('curated')}
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
              onClick={() => onApprovalFilterChange('listed')}
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
                onClick={() => onApprovalFilterChange('rejected')}
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
          </>
        )}
      </div>
    </div>
  );
}; 