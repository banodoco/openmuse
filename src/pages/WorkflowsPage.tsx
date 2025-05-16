import React, { useState, useMemo } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import AssetManager from '@/components/AssetManager';
import { useAssetManagement } from '@/hooks/useAssetManagement';
import { AdminStatus, AnyAsset, UserAssetPreferenceStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import UploadPage from '@/pages/upload/UploadPage';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAuth } from '@/hooks/useAuth';

const ITEMS_PER_PAGE = 12; // Or a suitable number for workflows page

const getTotalPages = (totalItems: number, pageSize: number): number => {
    if (pageSize <= 0 || totalItems <= 0) return 1;
    return Math.ceil(totalItems / pageSize);
};

const WorkflowsPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth(); // For admin-specific actions if any

  const [currentPage, setCurrentPage] = useState(1);
  const [approvalFilter, setApprovalFilter] = useState<'curated' | 'all'>('curated');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const {
    assets: workflows,
    isLoading: isLoadingWorkflows,
    totalCount: totalWorkflows,
    refetchAssets: refetchWorkflows,
    setAssetAdminStatus: setWorkflowAdminStatus, // For potential admin actions on this page
  } = useAssetManagement({
    assetType: 'workflow',
    approvalFilter: approvalFilter,
    page: currentPage,
    pageSize: ITEMS_PER_PAGE,
  });

  const totalPages = useMemo(() => {
    return getTotalPages(totalWorkflows, ITEMS_PER_PAGE);
  }, [totalWorkflows]);

  const handleWorkflowUploadSuccess = () => {
    setIsUploadModalOpen(false);
    refetchWorkflows();
    // toast.success("Workflow added successfully!"); // Toast is handled in UploadPage
  };
  
  const renderPaginationControls = () => {
    if (totalPages <= 1) return null;
    const handlePrevious = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
    const handleNext = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
    const paginationItems = [];
    const maxPagesToShow = 5;
    const ellipsis = <PaginationEllipsis key="workflow-page-ellipsis" />;
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) paginationItems.push(<PaginationItem key={`wf-page-${i}`}><PaginationLink href="#" isActive={currentPage === i} onClick={(e) => { e.preventDefault(); setCurrentPage(i); }}>{i}</PaginationLink></PaginationItem>);
    } else {
      paginationItems.push(<PaginationItem key="wf-page-1"><PaginationLink href="#" isActive={currentPage === 1} onClick={(e) => { e.preventDefault(); setCurrentPage(1); }}>1</PaginationLink></PaginationItem>);
      if (currentPage > 3) paginationItems.push(React.cloneElement(ellipsis, { key: "wf-start-ellipsis" }));
      let startP = Math.max(2, currentPage - 1); let endP = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) endP = Math.min(totalPages - 1, maxPagesToShow - 2);
      if (currentPage >= totalPages - 2) startP = Math.max(2, totalPages - maxPagesToShow + 2);
      for (let i = startP; i <= endP; i++) paginationItems.push(<PaginationItem key={`wf-page-${i}`} className={cn(currentPage === i ? "" : "hidden md:list-item")}><PaginationLink href="#" isActive={currentPage === i} onClick={(e) => { e.preventDefault(); setCurrentPage(i); }}>{i}</PaginationLink></PaginationItem>);
      if (currentPage < totalPages - 2) paginationItems.push(React.cloneElement(ellipsis, { key: "wf-end-ellipsis" }));
      paginationItems.push(<PaginationItem key={`wf-page-${totalPages}`}><PaginationLink href="#" isActive={currentPage === totalPages} onClick={(e) => { e.preventDefault(); setCurrentPage(totalPages); }}>{totalPages}</PaginationLink></PaginationItem>);
    }
    return (
      <Pagination className="mt-6">
        <PaginationContent>
          <PaginationItem><PaginationPrevious href="#" onClick={(e)=>{e.preventDefault();handlePrevious();}} aria-disabled={currentPage===1} className={cn(currentPage===1 && 'pointer-events-none opacity-50')}/></PaginationItem>
          {paginationItems}
          <PaginationItem><PaginationNext href="#" onClick={(e)=>{e.preventDefault();handleNext();}} aria-disabled={currentPage===totalPages} className={cn(currentPage===totalPages && 'pointer-events-none opacity-50')}/></PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <PageHeader 
            title="Workflows"
            description="Browse and discover community-shared workflows."
          />

          <div className="flex flex-col sm:flex-row justify-between items-center mt-2 mb-6 gap-4">
            <ToggleGroup 
              type="single" 
              value={approvalFilter} 
              onValueChange={(value) => { if (value === 'curated' || value === 'all') { setApprovalFilter(value as 'curated' | 'all'); setCurrentPage(1); }}}
              className="bg-muted/50 p-1 rounded-lg"
            >
              <ToggleGroupItem value="curated" aria-label="Toggle curated" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">Curated</ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="Toggle all" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">All</ToggleGroupItem>
            </ToggleGroup>
            
            <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost"
                  size={isMobile ? "sm" : "default"} 
                  className={cn("border border-input hover:bg-accent hover:text-accent-foreground", "text-muted-foreground", isMobile ? "h-9" : "h-10")}
                >
                  Add New Workflow
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                <UploadPage initialMode="workflow" hideLayout={true} onSuccess={handleWorkflowUploadSuccess} />
              </DialogContent>
            </Dialog>
          </div>

          <AssetManager
            assets={workflows || []}
            assetTypeToDisplay='workflow' // Ensure AssetManager uses this if provided
            title="" // Header is handled by PageHeader
            showHeader={false} // AssetManager's internal header not needed
            isLoading={isLoadingWorkflows}
            isAdmin={isAdmin || false}
            onAdminStatusChange={setWorkflowAdminStatus}
            // Pass other necessary props like onUserStatusChange if applicable for workflows on this page
            itemsPerRow={isMobile ? 2 : 4} // Example: adjust items per row
          />
          {renderPaginationControls()}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default WorkflowsPage; 