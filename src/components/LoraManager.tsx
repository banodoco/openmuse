import React, { useMemo, useState } from 'react';
import { LoraAsset } from '@/lib/types';
import LoraList from './lora/LoraList';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { Logger } from '@/lib/logger';
import { LoraGallerySkeleton } from './LoraGallerySkeleton';
import { LoraFilters } from './lora/LoraFilters';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";

const logger = new Logger('LoraManager');
logger.log('LoraManager component module loaded');

interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading?: boolean;
  lorasAreLoading?: boolean;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  isAdmin?: boolean;
  onNavigateToUpload?: () => void;
  onRefreshData?: () => void;
  showSeeAllLink?: boolean;
}

const LoraManager: React.FC<LoraManagerProps> = ({ 
  loras, 
  isLoading = false,
  lorasAreLoading = false,
  filterText,
  onFilterTextChange,
  isAdmin,
  onNavigateToUpload,
  onRefreshData,
  showSeeAllLink,
}) => {
  logger.log(`LoraManager rendering/initializing. Props: isLoading (videos)=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, filterText=${filterText}, isAdmin=${isAdmin}`);

  const { isAdmin: authIsAdmin } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredLoras = loras;

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterTextChange(event.target.value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
          LoRAs
        </h2>
        {showSeeAllLink && (
          <Link
            to="/loras"
            className="text-sm text-primary hover:underline ml-auto"
          >
            See all curated LoRAs →
          </Link>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : lorasAreLoading ? (
        <LoraGallerySkeleton count={6} />
      ) : !loras || loras.length === 0 ? (
        <EmptyState 
          title="No LoRAs Available" 
          description="There are currently no LoRAs in the collection that match your filters. Upload a new LoRA or adjust filters!" 
        />
      ) : (
        <LoraList loras={filteredLoras} />
      )}
    </div>
  );
};

export default LoraManager;
