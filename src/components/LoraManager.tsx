import React, { useMemo, useState } from 'react';
import { LoraAsset, UserAssetPreferenceStatus, AdminStatus } from '@/lib/types';
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
  filterText?: string;
  onFilterTextChange?: (text: string) => void;
  isAdmin?: boolean;
  onNavigateToUpload?: () => void;
  onRefreshData?: () => void;
  showSeeAllLink?: boolean;
  /** The current approval filter state from the parent */
  approvalFilter?: 'all' | 'curated';
  onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
  onAdminStatusChange?: (assetId: string, newStatus: AdminStatus) => Promise<void>;
  isUpdatingStatusMap?: Record<string, boolean>;
  /** Optional prop to control the visibility of the internal header (h2 and See All link). Defaults to true. */
  showHeader?: boolean;
  /** Optional ReactNode to render in the header, typically the 'Add New' button */
  headerAction?: React.ReactNode;
  /** Optional prop to hide creator info on the LoraCard. Defaults to false. */
  hideCreatorInfo?: boolean;
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
  approvalFilter = 'curated', // Default to 'curated' if not provided
  onUserStatusChange,
  onAdminStatusChange,
  isUpdatingStatusMap,
  showHeader = true, // Default to true if not provided
  headerAction, // Add new prop
  hideCreatorInfo = false, // Default to false
}) => {
  logger.log(`LoraManager rendering/initializing. Props: isLoading (videos)=${isLoading}, lorasAreLoading=${lorasAreLoading}, loras count=${loras?.length || 0}, filterText=${filterText}, isAdmin=${isAdmin}, showHeader=${showHeader}`);

  const { isAdmin: authIsAdmin } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredLoras = Array.isArray(loras) ? loras : [];

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterTextChange?.(event.target.value);
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-transparent px-4 py-2 rounded-md">
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-[#2F4F2E]/75">
            LoRAs
          </h2>
          {headerAction && <div className="ml-auto">{headerAction}</div>}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : lorasAreLoading ? (
        <LoraGallerySkeleton count={3} />
      ) : !loras || loras.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          There are no LoRAs matching the current filter.
        </p>
      ) : (
        <LoraList 
          loras={filteredLoras} 
          onUserStatusChange={onUserStatusChange}
          onAdminStatusChange={onAdminStatusChange}
          isUpdatingStatusMap={isUpdatingStatusMap}
          isAdmin={isAdmin}
          hideCreatorInfo={hideCreatorInfo}
        />
      )}
    </div>
  );
};

export default LoraManager;
