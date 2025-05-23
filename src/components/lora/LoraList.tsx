import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LoraAsset, UserAssetPreferenceStatus, AdminStatus } from '@/lib/types';
import { FileVideo } from 'lucide-react';
import LoraCard from './LoraCard';
import { Logger } from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const logger = new Logger('LoraList');
const LORA_LIST_PERF_ID_PREFIX = '[LoraLoadSpeed_LoraList]';

interface LoraListProps {
  loras: LoraAsset[];
  initialModelFilter?: string;
  isAdmin?: boolean;
  onUserStatusChange?: (assetId: string, newStatus: UserAssetPreferenceStatus) => Promise<void>;
  onAdminStatusChange?: (assetId: string, newStatus: AdminStatus) => Promise<void>;
  isUpdatingStatusMap?: Record<string, boolean>;
  /** Whether to hide creator info on the LoraCard. Defaults to false. */
  hideCreatorInfo?: boolean;
}

const LoraList: React.FC<LoraListProps> = ({ 
  loras, 
  isAdmin, 
  onUserStatusChange,
  onAdminStatusChange,
  isUpdatingStatusMap,
  hideCreatorInfo = false,
}) => {
  const renderId = React.useId(); // Generate ID once per render
  console.log(`[LoraLoadSpeed_LoraList_Instance:${renderId}] Received loras count:`, loras?.length);
  console.time(`${LORA_LIST_PERF_ID_PREFIX}_Render_${renderId}`);
  const isMobile = useIsMobile();
  
  // Add state and refs for autoplay
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unmountedRef = useRef(false);
  
  console.time(`${LORA_LIST_PERF_ID_PREFIX}_PropsAndStateInitialization`);
  
  useEffect(() => {
    console.time(`${LORA_LIST_PERF_ID_PREFIX}_LorasPropEffect`);
    logger.log("LoraList received loras:", loras?.length || 0);
    console.timeEnd(`${LORA_LIST_PERF_ID_PREFIX}_LorasPropEffect`);
  }, [loras]);

  // Ensure loras is an array
  const safeLoraList = Array.isArray(loras) ? loras : [];

  // Pagination logic
  const itemsPerPage = 15;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(safeLoraList.length / itemsPerPage);

  useEffect(() => {
    // Reset to page 1 whenever the list of LoRAs changes
    setCurrentPage(1);
  }, [safeLoraList]);

  // Cleanup effect for timeout
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, []);

  // Debounced visibility handler
  const handleVideoVisibilityChange = useCallback((loraId: string, isVisible: boolean) => {
    // logger.log(`LoraList: Visibility change reported for ${loraId}: ${isVisible}`);
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = null;
    }
    if (isVisible) {
      visibilityTimeoutRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          // logger.log(`LoraList: Debounced - Setting visible video to ${loraId}`);
          setVisibleVideoId(loraId);
        }
      }, 150); // 150ms debounce
    } else {
      setVisibleVideoId(prevVisibleId => {
        if (prevVisibleId === loraId) {
          // logger.log(`LoraList: Clearing visible video ${loraId} (became hidden)`);
          return null;
        }
        return prevVisibleId;
      });
    }
  }, []);

  // Handler for preload area entry (optional, could just trigger in card)
  const handleEnterPreloadArea = useCallback((loraId: string, isInArea: boolean) => {
    if (isInArea) {
      // logger.log(`LoraList: Preload area entered for ${loraId}. (Handled in StorageVideoPlayer)`);
      // Preloading is initiated within StorageVideoPlayer based on this callback triggering
    }
  }, []);

  const paginatedLoras = React.useMemo(() => {
    console.time(`${LORA_LIST_PERF_ID_PREFIX}_PaginatedLorasMemo`);
    const start = (currentPage - 1) * itemsPerPage;
    const result = safeLoraList.slice(start, start + itemsPerPage);
    console.timeEnd(`${LORA_LIST_PERF_ID_PREFIX}_PaginatedLorasMemo`);
    return result;
  }, [safeLoraList, currentPage]);

  console.timeEnd(`${LORA_LIST_PERF_ID_PREFIX}_PropsAndStateInitialization`);

  // Log end of render time directly here. Note: This is less accurate for async effects within render but safer for avoiding timer warnings.
  // The actual perceived end of render is when the browser paints.
  console.timeEnd(`${LORA_LIST_PERF_ID_PREFIX}_Render_${renderId}`);

  return (
    <div className="space-y-4">
      {paginatedLoras.length > 0 ? (
        <div 
          className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {paginatedLoras.map((lora) => (
            <LoraCard 
              key={lora.id}
              lora={lora} 
              isAdmin={isAdmin}
              onUserStatusChange={onUserStatusChange}
              onAdminStatusChange={onAdminStatusChange}
              isUpdatingStatus={isUpdatingStatusMap ? isUpdatingStatusMap[lora.id] : undefined}
              onVisibilityChange={handleVideoVisibilityChange}
              shouldBePlaying={isMobile && lora.id === visibleVideoId}
              onEnterPreloadArea={handleEnterPreloadArea}
              hideCreatorInfo={hideCreatorInfo}
            />
          ))}
        </div>
      ) : (
        <div className="col-span-full text-center py-8">
          <FileVideo className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="mt-2 text-lg font-medium">No LoRAs found</h3>
          <p className="text-muted-foreground">Try different filter settings</p>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={
                  currentPage === 1
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer hover:bg-muted/50 transition-colors'
                }
              />
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={
                  currentPage === totalPages
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer hover:bg-muted/50 transition-colors'
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default LoraList;
