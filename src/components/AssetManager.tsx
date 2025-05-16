import React, { useMemo, useState } from 'react';
import { AnyAsset, UserAssetPreferenceStatus, AdminStatus, AssetType } from '@/lib/types'; // Updated to AnyAsset, AssetType
import AssetCard from './asset/AssetCard'; // Path to the new AssetCard
// import LoraList from './lora/LoraList'; // Will be replaced or generalized
import LoadingState from './LoadingState';
// import EmptyState from './EmptyState'; // Can be used directly if needed
import { Logger } from '@/lib/logger';
import { LoraGallerySkeleton } from './LoraGallerySkeleton'; // May need generalization to AssetGallerySkeleton
// import { LoraFilters } from './lora/LoraFilters'; // Filters might be asset-type specific
import { useAuth } from '@/hooks/useAuth';
// import { Link } from 'react-router-dom'; // If "See All" link is used
// import { Input } from "@/components/ui/input"; // If search is part of manager
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // If filters are part of manager

const logger = new Logger('AssetManager');
logger.log('AssetManager component module loaded');

interface AssetManagerProps {
  assets: AnyAsset[];
  assetTypeToDisplay?: AssetType; // Optional: to filter which type of assets to show from the mixed array
  title?: string; // To dynamically set the section title e.g. "LoRAs", "Workflows"
  isLoading?: boolean; // General loading state for the assets
  // assetsAreLoading?: boolean; // Replaced by isLoading or can be more specific if needed
  filterText?: string; // If search is implemented here
  onFilterTextChange?: (text: string) => void;
  isAdmin?: boolean;
  // onNavigateToUpload?: () => void; // Handled by headerAction now
  onRefreshData?: () => void;
  // showSeeAllLink?: boolean; // Can be controlled by parent via header or a specific prop
  approvalFilter?: 'all' | 'curated';
  onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
  onAdminStatusChange?: (assetId: string, newStatus: AdminStatus) => Promise<void>;
  isUpdatingStatusMap?: Record<string, boolean>;
  showHeader?: boolean;
  headerAction?: React.ReactNode;
  hideCreatorInfo?: boolean;
  itemsPerRow?: number; // For grid layout
}

const AssetManager: React.FC<AssetManagerProps> = ({ 
  assets,
  assetTypeToDisplay, // If we want the manager to filter by type
  title = "Assets", // Default title
  isLoading = false,
  // assetsAreLoading = false, // Using isLoading primarily
  filterText, // Assuming text filtering is still desired
  onFilterTextChange, // Corresponding handler
  isAdmin,
  onRefreshData,
  approvalFilter = 'curated',
  onUserStatusChange,
  onAdminStatusChange,
  isUpdatingStatusMap,
  showHeader = true,
  headerAction,
  hideCreatorInfo = false,
  itemsPerRow = 3, // Default items per row for grid
}) => {
  logger.log(`AssetManager rendering. Assets count: ${assets?.length || 0}, isLoading: ${isLoading}, title: ${title}`);

  // const { isAdmin: authIsAdmin } = useAuth(); // Already have isAdmin prop

  const assetsToDisplay = useMemo(() => {
    let processedAssets = Array.isArray(assets) ? assets : [];
    if (assetTypeToDisplay) {
      processedAssets = processedAssets.filter(asset => asset.type === assetTypeToDisplay);
    }
    // Add text filtering if filterText and onFilterTextChange are provided
    if (filterText && processedAssets.length > 0) {
      const lowerCaseFilter = filterText.toLowerCase();
      processedAssets = processedAssets.filter(asset => 
        asset.name?.toLowerCase().includes(lowerCaseFilter) ||
        asset.description?.toLowerCase().includes(lowerCaseFilter) ||
        (asset.type === 'lora' && (asset as any).lora_base_model?.toLowerCase().includes(lowerCaseFilter)) ||
        asset.creator?.toLowerCase().includes(lowerCaseFilter)
      );
    }
    return processedAssets;
  }, [assets, assetTypeToDisplay, filterText]);

  // const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   onFilterTextChange?.(event.target.value);
  // };

  // Grid styling based on itemsPerRow
  const gridColsClass = useMemo(() => {
    switch (itemsPerRow) {
      case 1: return 'grid-cols-1';
      case 2: return 'sm:grid-cols-2';
      case 3: return 'sm:grid-cols-2 md:grid-cols-3'; // Default like LoraList
      case 4: return 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      case 6: return 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'; 
      default: return 'sm:grid-cols-2 md:grid-cols-3';
    }
  }, [itemsPerRow]);

  if (isLoading) {
    // Use LoraGallerySkeleton for now, can be replaced with AssetGallerySkeleton
    return <LoraGallerySkeleton count={itemsPerRow} />;
  }

  if (!assetsToDisplay || assetsToDisplay.length === 0) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-transparent px-4 py-2 rounded-md">
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-[#2F4F2E]/75">
              {title}
            </h2>
            {headerAction && <div className="ml-auto">{headerAction}</div>}
          </div>
        )}
        <p className="text-muted-foreground text-sm p-4 text-center">
          There are no {assetTypeToDisplay || 'assets'} matching the current filter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-transparent px-4 py-2 rounded-md mb-4">
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-[#2F4F2E]/75">
            {title}
          </h2>
          {headerAction && <div className="ml-auto">{headerAction}</div>}
        </div>
      )}
      
      {/* Render AssetCards in a grid */}
      <div className={`grid gap-4 ${gridColsClass}`}>
        {assetsToDisplay.map((asset) => (
          <AssetCard 
            key={asset.id} 
            asset={asset} 
            isAdmin={isAdmin}
            onUserStatusChange={onUserStatusChange}
            onAdminStatusChange={onAdminStatusChange}
            isUpdatingStatus={isUpdatingStatusMap ? isUpdatingStatusMap[asset.id] : false}
            hideCreatorInfo={hideCreatorInfo} // Pass down hideCreatorInfo
            // Add other necessary props for AssetCard like isOwnProfile if contextually available
          />
        ))}
      </div>
    </div>
  );
};

export default AssetManager; 