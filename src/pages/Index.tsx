import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import { useAssetManagement } from '@/hooks/useAssetManagement';
import AssetManager from '@/components/AssetManager';
import { useAuth } from '@/hooks/useAuth';
import { testRLSPermissions } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import { supabase } from '@/lib/supabase';
import { AnyAsset, VideoEntry, AdminStatus, AssetType, LoraAsset, WorkflowAsset } from '@/lib/types';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import UploadPage from '@/pages/upload/UploadPage';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import VideoLightbox from '@/components/VideoLightbox';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';

const logger = new Logger('IndexPage', true, 'SessionPersist');
const ASSET_INDEX_PERF_ID_PREFIX = '[AssetLoadSpeed_IndexPage]';
const INDEX_ITEMS_PER_PAGE = 6;

const ART_PAGE_SIZE = 8;
const GENERATION_PAGE_SIZE = 12;
const ART_ITEMS_PER_ROW = 4;
const GENERATION_ITEMS_PER_ROW = 6;
const ASSET_ITEMS_PER_ROW_DESKTOP = 3;
const ASSET_ITEMS_PER_ROW_MOBILE = 2;

const getPaginatedItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
    if (pageSize <= 0) return items;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, Math.min(endIndex, items.length));
};

const getTotalPages = (totalItems: number, pageSize: number): number => {
    if (pageSize <= 0 || totalItems <= 0) return 1;
    return Math.ceil(totalItems / pageSize);
};

const scrollToElementWithOffset = (element: HTMLElement | null, offset: number = -150) => {
  if (!element) return;
  const y = element.getBoundingClientRect().top + window.pageYOffset + offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
};

const Index: React.FC = () => {
  logger.log('[Index] component rendered');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading, isAdmin } = useAuth();

  const [isLoraUploadModalOpen, setIsLoraUploadModalOpen] = useState(false);
  const [isWorkflowUploadModalOpen, setIsWorkflowUploadModalOpen] = useState(false);
  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  
  const [artPage, setArtPage] = useState(1);
  const [generationPage, setGenerationPage] = useState(1);
  
  const artSectionRef = useRef<HTMLDivElement>(null);
  const generationsSectionRef = useRef<HTMLDivElement>(null);
  const loraSectionRef = useRef<HTMLDivElement>(null);
  const workflowSectionRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  
  const { 
    videos, 
    isLoading: videosLoading, 
    refetchVideos, 
    setVideoAdminStatus
  } = useVideoManagement();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const modelFilterFromUrl = searchParams.get('model') || 'all';
  const [currentModelFilter, setCurrentModelFilter] = useState(modelFilterFromUrl);
  const [filterText, setFilterText] = useState('');
  const [currentApprovalFilter, setCurrentApprovalFilter] = useState<'curated' | 'all'>('curated');
  
  const [loraDisplayPage, setLoraDisplayPage] = useState(1);
  const [workflowDisplayPage, setWorkflowDisplayPage] = useState(1);

  const { 
    assets: loras,
    isLoading: lorasLoading, 
    totalCount: totalLoras, 
    refetchAssets: refetchLoras,
    setAssetAdminStatus: setLoraAdminStatus
  } = useAssetManagement({ 
    assetType: 'lora',
    modelFilter: currentModelFilter, 
    approvalFilter: currentApprovalFilter,
    page: loraDisplayPage,
    pageSize: INDEX_ITEMS_PER_PAGE
  });

  const { 
    assets: workflows,
    isLoading: workflowsLoading, 
    totalCount: totalWorkflows, 
    refetchAssets: refetchWorkflows, 
    setAssetAdminStatus: setWorkflowAdminStatus 
  } = useAssetManagement({ 
    assetType: 'workflow',
    approvalFilter: currentApprovalFilter,
    page: workflowDisplayPage,
    pageSize: INDEX_ITEMS_PER_PAGE
  });

  const displayLoras = React.useMemo(() => {
    if (!loras || loras.length === 0) return [];
    if (!filterText) return loras;
    const lowerCaseFilter = filterText.toLowerCase();
    return loras.filter(lora => 
      lora.name?.toLowerCase().includes(lowerCaseFilter) ||
      lora.description?.toLowerCase().includes(lowerCaseFilter) ||
      lora.creator?.toLowerCase().includes(lowerCaseFilter) ||
      (lora.type === 'lora' && (lora as LoraAsset).lora_base_model?.toLowerCase().includes(lowerCaseFilter))
    );
  }, [loras, filterText]);

  const displayWorkflows = React.useMemo(() => {
    if (!workflows || workflows.length === 0) return [];
    if (!filterText) return workflows;
    const lowerCaseFilter = filterText.toLowerCase();
    return workflows.filter(wf => 
      wf.name?.toLowerCase().includes(lowerCaseFilter) ||
      wf.description?.toLowerCase().includes(lowerCaseFilter) ||
      wf.creator?.toLowerCase().includes(lowerCaseFilter)
    );
  }, [workflows, filterText]);

  const totalLoraDisplayPages = React.useMemo(() => {
    return getTotalPages(totalLoras, INDEX_ITEMS_PER_PAGE);
  }, [totalLoras]);

  const totalWorkflowDisplayPages = React.useMemo(() => {
    return getTotalPages(totalWorkflows, INDEX_ITEMS_PER_PAGE);
  }, [totalWorkflows]);

  const handleRefreshData = useCallback(async () => {
    await Promise.all([refetchLoras(), refetchWorkflows(), refetchVideos()]);
  }, [refetchLoras, refetchWorkflows, refetchVideos, user]);

  const handleLoraUploadSuccess = useCallback(() => {
    setIsLoraUploadModalOpen(false);
    refetchLoras();
    toast.success("LoRA added successfully!");
  }, [refetchLoras]);

  const handleWorkflowUploadSuccess = useCallback(() => {
    setIsWorkflowUploadModalOpen(false);
    refetchWorkflows();
    toast.success("Workflow added successfully!");
  }, [refetchWorkflows]);

  const handleArtUploadSuccess = useCallback(() => {
    refetchVideos();
    toast.success("Art uploaded successfully!");
  }, [refetchVideos]);

  const handleGenerationUploadSuccess = useCallback(() => {
    refetchVideos();
    toast.success("Generation uploaded successfully!");
  }, [refetchVideos]);

  const isPageLoading = videosLoading || lorasLoading || workflowsLoading;
  const isActionDisabled = authLoading || isPageLoading;

  useEffect(() => {
    setLoraDisplayPage(1);
  }, [currentModelFilter]);

  useEffect(() => {
    setLoraDisplayPage(1);
    setWorkflowDisplayPage(1);
  }, [currentApprovalFilter]);

  const displayVideos = React.useMemo(() => {
    if (currentApprovalFilter === 'all') {
      return videos.filter(v => ['Curated', 'Featured', 'Listed'].includes(v.admin_status));
    } else {
      return videos.filter(v => ['Curated', 'Featured'].includes(v.admin_status));
    }
  }, [videos, currentApprovalFilter]);

  const displayArtVideos = React.useMemo(() => {
    const filtered = displayVideos.filter(v => v.metadata?.classification === 'art');
    return { items: getPaginatedItems(filtered, artPage, ART_PAGE_SIZE), totalPages: getTotalPages(filtered.length, ART_PAGE_SIZE) };
  }, [displayVideos, artPage]);

  const displayGenVideos = React.useMemo(() => {
    const filtered = displayVideos.filter(v => v.metadata?.classification !== 'art');
    return { items: getPaginatedItems(filtered, generationPage, GENERATION_PAGE_SIZE), totalPages: getTotalPages(filtered.length, GENERATION_PAGE_SIZE) };
  }, [displayVideos, generationPage]);
  
  const handleArtPageChange = useCallback((newPage: number) => {
    setArtPage(newPage);
    if (isMobile) scrollToElementWithOffset(artSectionRef.current);
  }, [isMobile]);

  const handleGenerationPageChange = useCallback((newPage: number) => {
    setGenerationPage(newPage);
    if (isMobile) scrollToElementWithOffset(generationsSectionRef.current);
  }, [isMobile]);

  const renderPaginationControls = (
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void,
    keyPrefix: string
  ) => {
    if (totalPages <= 1) return null;
    const handlePrevious = () => { if (currentPage > 1) onPageChange(currentPage - 1); };
    const handleNext = () => { if (currentPage < totalPages) onPageChange(currentPage + 1); };
    const paginationItems = [];
    const maxPagesToShow = 5;
    const ellipsis = <PaginationEllipsis key={`${keyPrefix}-ellipsis`} />;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        paginationItems.push(
          <PaginationItem key={`${keyPrefix}-${i}`}>
            <PaginationLink href="#" isActive={currentPage === i} onClick={(e) => { e.preventDefault(); onPageChange(i); }}>{i}</PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      paginationItems.push(<PaginationItem key={`${keyPrefix}-1`}><PaginationLink href="#" isActive={currentPage === 1} onClick={(e) => { e.preventDefault(); onPageChange(1); }}>1</PaginationLink></PaginationItem>);
      if (currentPage > 3) paginationItems.push(React.cloneElement(ellipsis, { key: `${keyPrefix}-start-ellipsis` }));
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) endPage = Math.min(totalPages - 1, maxPagesToShow - 2);
      if (currentPage >= totalPages - 2) startPage = Math.max(2, totalPages - maxPagesToShow + 2);
      for (let i = startPage; i <= endPage; i++) {
        paginationItems.push(
          <PaginationItem key={`${keyPrefix}-${i}`} className={cn(currentPage === i ? "" : "hidden md:list-item")}>
            <PaginationLink href="#" isActive={currentPage === i} onClick={(e) => { e.preventDefault(); onPageChange(i); }}>{i}</PaginationLink>
          </PaginationItem>
        );
      }
      if (currentPage < totalPages - 2) paginationItems.push(React.cloneElement(ellipsis, { key: `${keyPrefix}-end-ellipsis` }));
      paginationItems.push(<PaginationItem key={`${keyPrefix}-${totalPages}`}><PaginationLink href="#" isActive={currentPage === totalPages} onClick={(e) => { e.preventDefault(); onPageChange(totalPages); }}>{totalPages}</PaginationLink></PaginationItem>);
    }
    return (
      <Pagination className="mt-6">
        <PaginationContent>
          <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePrevious(); }} aria-disabled={currentPage === 1} className={cn(currentPage === 1 && 'pointer-events-none opacity-50')} /></PaginationItem>
          {paginationItems}
          <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); handleNext(); }} aria-disabled={currentPage === totalPages} className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')} /></PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  const [videoAssetMap, setVideoAssetMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!videos || videos.length === 0) return;
    const fetchAssetAssociations = async () => {
      const videoIds = videos.map(v => v.id);
      const { data: assetLinks, error: linksError } = await supabase.from('asset_media').select('media_id, asset_id').in('media_id', videoIds);
      if (linksError) { logger.error('Error fetching asset_media links:', linksError); return; }
      const newMap: Record<string, string> = {};
      assetLinks?.forEach(link => { if (link.media_id && link.asset_id) newMap[link.media_id] = link.asset_id; });
      setVideoAssetMap(newMap);
    };
    fetchAssetAssociations();
  }, [videos]);

  const handleOpenLightbox = useCallback((video: VideoEntry) => { setLightboxVideo(video); }, []);
  const handleCloseLightbox = useCallback(() => { setLightboxVideo(null); }, []);
  const lightboxVideoList = useMemo(() => [...displayArtVideos.items, ...displayGenVideos.items], [displayArtVideos.items, displayGenVideos.items]);
  const currentLightboxIndex = useMemo(() => lightboxVideo && lightboxVideoList.findIndex(v => v.id === lightboxVideo.id) || -1, [lightboxVideo, lightboxVideoList]);
  const handlePrevLightboxVideo = useCallback(() => { if (currentLightboxIndex > 0) setLightboxVideo(lightboxVideoList[currentLightboxIndex - 1]); }, [currentLightboxIndex, lightboxVideoList, setLightboxVideo]);
  const handleNextLightboxVideo = useCallback(() => { if (currentLightboxIndex !== -1 && currentLightboxIndex < lightboxVideoList.length - 1) setLightboxVideo(lightboxVideoList[currentLightboxIndex + 1]); }, [currentLightboxIndex, lightboxVideoList, setLightboxVideo]);
  const handleVideoAdminStatusChange = useCallback(async (videoId: string, newStatus: AdminStatus) => { try { await setVideoAdminStatus(videoId, newStatus); } catch (error) { logger.error(`[IndexPage] Error in handleVideoAdminStatusChange for ${videoId} to ${newStatus}:`, error); } }, [setVideoAdminStatus]);
  const getLightboxAdminStatusChangeHandler = useCallback((videoId: string) => async (newStatus: AdminStatus) => { try { await setVideoAdminStatus(videoId, newStatus); handleCloseLightbox(); } catch (error) { logger.error(`[Lightbox] Error changing admin status for ${videoId} to ${newStatus}:`, error); } }, [setVideoAdminStatus, handleCloseLightbox]);
  const handleLightboxVideoUpdate = useCallback(() => { refetchVideos(); }, [refetchVideos]);
  useEffect(() => { const videoParam = searchParams.get('video'); if (videoParam && (!lightboxVideo || lightboxVideo.id !== videoParam) && videos && videos.length > 0) { const found = videos.find(v => v.id === videoParam); if (found) handleOpenLightbox(found); } }, [searchParams, videos, lightboxVideo, handleOpenLightbox]);

  useFadeInOnScroll(heroRef);
  useFadeInOnScroll(loraSectionRef);
  useFadeInOnScroll(workflowSectionRef);
  useFadeInOnScroll(artSectionRef);
  useFadeInOnScroll(generationsSectionRef);

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <div ref={heroRef} className="pt-2 pb-0 mb-4">
            <PageHeader 
              title="Curated resources, art & workflows for open video models"
              description="A collection of LoRAs, Workflows, and art for open video models like LTXV, Stable Video Diffusion, and Hunyuan."
            />
          </div>

          <div className="flex justify-start mt-2 mb-6">
            <ToggleGroup type="single" value={currentApprovalFilter} onValueChange={(value) => { if (value === 'curated' || value === 'all') setCurrentApprovalFilter(value as 'curated' | 'all'); }} className="bg-muted/50 p-1 rounded-lg">
              <ToggleGroupItem value="curated" aria-label="Toggle curated" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">Curated</ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="Toggle all" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">All</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator className="mt-0 mb-4" />

          <div ref={artSectionRef} className="mb-8">
            <VideoGallerySection
              header="Art"
              videos={displayArtVideos.items}
              isLoading={videosLoading}
              seeAllPath={currentApprovalFilter === 'all' ? "/art?approval=all" : "/art"}
              alwaysShowInfo={true}
              emptyMessage="There's no art matching the current filter."
              showAddButton={true}
              addButtonClassification="art"
              itemsPerRow={ART_ITEMS_PER_ROW}
              onOpenLightbox={handleOpenLightbox}
              approvalFilter={currentApprovalFilter}
              headerTextClass="text-[#2F4F2E]/75"
              onUploadSuccess={handleArtUploadSuccess}
              isAdmin={isAdmin}
              isAuthorized={!!user}
              onAdminStatusChange={handleVideoAdminStatusChange}
            />
            {renderPaginationControls(artPage, displayArtVideos.totalPages, handleArtPageChange, 'art')}
          </div>

          <Separator className="mt-0 mb-4" />

          <div ref={loraSectionRef}>
            <AssetManager
              assets={displayLoras} 
              assetTypeToDisplay='lora' 
              title="LoRAs"
              isLoading={lorasLoading}
              isAdmin={isAdmin || false}
              onRefreshData={handleRefreshData} 
              approvalFilter={currentApprovalFilter}
              onAdminStatusChange={setLoraAdminStatus} 
              headerAction={(
                <Dialog open={isLoraUploadModalOpen} onOpenChange={setIsLoraUploadModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size={isMobile ? "sm" : "default"} disabled={isActionDisabled} className={cn("border border-input hover:bg-accent hover:text-accent-foreground", "text-muted-foreground", isMobile ? "h-9 rounded-md px-3" : "h-10 px-4 py-2")}>Add New LoRA</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                    <UploadPage initialMode="lora" hideLayout={true} onSuccess={handleLoraUploadSuccess} />
                  </DialogContent>
                </Dialog>
              )}
              itemsPerRow={isMobile ? ASSET_ITEMS_PER_ROW_MOBILE : ASSET_ITEMS_PER_ROW_DESKTOP}
            />
            {totalLoraDisplayPages > 1 && renderPaginationControls(loraDisplayPage, totalLoraDisplayPages, setLoraDisplayPage, 'lora')}
            <div className="mt-6 mb-8 flex justify-start">
              <Link to={currentApprovalFilter === 'all' ? "/loras?approval=all" : "/loras"} className="text-sm text-primary hover:underline group">See all {currentApprovalFilter === 'curated' ? 'curated ' : ''}LoRAs <span className="inline-block transition-transform duration-200 ease-in-out group-hover:translate-x-1">→</span></Link>
            </div>
          </div>
          
          <Separator className="mt-0 mb-4" />

          <div ref={workflowSectionRef}>
            <AssetManager
              assets={displayWorkflows} 
              assetTypeToDisplay='workflow'
              title="Workflows"
              isLoading={workflowsLoading}
              isAdmin={isAdmin || false}
              onRefreshData={handleRefreshData}
              approvalFilter={currentApprovalFilter}
              onAdminStatusChange={setWorkflowAdminStatus} 
              headerAction={(
                <Dialog open={isWorkflowUploadModalOpen} onOpenChange={setIsWorkflowUploadModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size={isMobile ? "sm" : "default"} disabled={isActionDisabled} className={cn("border border-input hover:bg-accent hover:text-accent-foreground", "text-muted-foreground", isMobile ? "h-9 rounded-md px-3" : "h-10 px-4 py-2")}>Add New Workflow</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto pb-16 sm:pb-6">
                    <UploadPage initialMode="workflow" hideLayout={true} onSuccess={handleWorkflowUploadSuccess} />
                  </DialogContent>
                </Dialog>
              )}
              itemsPerRow={isMobile ? ASSET_ITEMS_PER_ROW_MOBILE : ASSET_ITEMS_PER_ROW_DESKTOP}
            />
            {totalWorkflowDisplayPages > 1 && renderPaginationControls(workflowDisplayPage, totalWorkflowDisplayPages, setWorkflowDisplayPage, 'workflow')}
             <div className="mt-6 mb-8 flex justify-start">
              <Link to={currentApprovalFilter === 'all' ? "/workflows?approval=all" : "/workflows"} className="text-sm text-primary hover:underline group">See all {currentApprovalFilter === 'curated' ? 'curated ' : ''}Workflows <span className="inline-block transition-transform duration-200 ease-in-out group-hover:translate-x-1">→</span></Link>
            </div>
          </div>

          <Separator className="mt-0 mb-4" />

          <div ref={generationsSectionRef} className="mb-4">
            <VideoGallerySection 
                header="Generations" 
                videos={displayGenVideos.items} 
                isLoading={videosLoading} 
                seeAllPath={currentApprovalFilter === 'all' ? "/generations?approval=all" : "/generations"} 
                alwaysShowInfo={true} 
                emptyMessage="There are no generations matching the current filter." 
                showAddButton={true}
                addButtonClassification="gen" 
                itemsPerRow={GENERATION_ITEMS_PER_ROW}
                forceCreatorHoverDesktop={true} 
                onOpenLightbox={handleOpenLightbox} 
                approvalFilter={currentApprovalFilter} 
                headerTextClass="text-[#2F4F2E]/75" 
                onUploadSuccess={handleGenerationUploadSuccess}
                isAdmin={isAdmin} 
                isAuthorized={!!user} 
                onAdminStatusChange={handleVideoAdminStatusChange} 
            />
            {renderPaginationControls(generationPage, displayGenVideos.totalPages, handleGenerationPageChange, 'gen')}
          </div>
        </div>
      </div>
      
      <Footer />
      {lightboxVideo && (
        <VideoLightbox 
          isOpen={!!lightboxVideo} 
          onClose={handleCloseLightbox} 
          video={lightboxVideo}
          initialAssetId={videoAssetMap[lightboxVideo.id]}
          isAuthorized={isAdmin}
          onStatusChange={undefined}
          onAdminStatusChange={getLightboxAdminStatusChangeHandler(lightboxVideo.id)} 
          onVideoUpdate={handleLightboxVideoUpdate} 
          hasPrev={currentLightboxIndex > 0} 
          hasNext={currentLightboxIndex !== -1 && currentLightboxIndex < lightboxVideoList.length - 1} 
          onPrevVideo={handlePrevLightboxVideo} 
          onNextVideo={handleNextLightboxVideo}
        />
      )}
    </div>
  );
};

export default Index;
