import React, { useCallback, useEffect, useState, useRef } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import LoraManager from '@/components/LoraManager';
import { useAuth } from '@/hooks/useAuth';
import { testRLSPermissions } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LoraAsset } from '@/lib/types';

const logger = new Logger('Index');
logger.log('Index page component module loaded');

const Index: React.FC = () => {
  logger.log('Index component rendering/mounting');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  logger.log(`Index: useAuth() state - user: ${user?.id || 'null'}, authLoading: ${authLoading}, isAdmin: ${isAdmin}`);

  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const permissionCheckInProgress = useRef(false);
  
  const [filterText, setFilterText] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('curated');
  const [currentModelFilter, setCurrentModelFilter] = useState(searchParams.get('model') || 'all');

  useEffect(() => {
    const currentModelInUrl = searchParams.get('model') || 'all';
    if (currentModelFilter !== currentModelInUrl) {
        if (currentModelFilter === 'all') {
            searchParams.delete('model');
        } else {
            searchParams.set('model', currentModelFilter);
        }
        setSearchParams(searchParams, { replace: true });
        logger.log(`[Effect Model Sync] Updated URL model filter to: ${currentModelFilter}`);
    }
  }, [currentModelFilter, searchParams, setSearchParams]);

  const { isLoading: videosLoading } = useVideoManagement();
  logger.log(`Index: useVideoManagement() state - videosLoading: ${videosLoading}`);
  
  const { data: fetchedLoras, isLoading: lorasAreLoadingQuery, refetch: refetchLoras } = useQuery<LoraAsset[]>({
    queryKey: ['loras', filterText, approvalFilter, currentModelFilter],
    queryFn: async () => {
      logger.log(`[QueryFn] Fetching loras with filters: text='${filterText}', approval='${approvalFilter}', model='${currentModelFilter}'`);
      let query = supabase
        .from('assets')
        .select('*') 
        
      if (filterText) {
         const textSearch = `%${filterText}%`;
         query = query.or(`name.ilike.${textSearch},creator.ilike.${textSearch}`);
         logger.log(`[QueryFn] Applied text filter: ${textSearch}`);
      }

      if (currentModelFilter !== 'all') {
        query = query.eq('lora_base_model', currentModelFilter);
        logger.log(`[QueryFn] Applied model filter: ${currentModelFilter}`);
      }

      if (approvalFilter !== 'all') {
        const capitalizedApprovalFilter = approvalFilter.charAt(0).toUpperCase() + approvalFilter.slice(1);
        query = query.eq('admin_approved', capitalizedApprovalFilter);
         logger.log(`[QueryFn] Applied approval filter: ${capitalizedApprovalFilter}`);
      } else {
          logger.log(`[QueryFn] Approval filter set to 'all', not applying DB filter.`);
      }

      query = query.order('created_at', { ascending: false });
      logger.log('[QueryFn] Applied sorting.');

      const { data, error } = await query;

      if (error) {
        logger.error('[QueryFn] Error fetching filtered loras:', error);
        toast.error(`Error fetching LoRAs: ${error.message}`);
        throw error;
      }

      logger.log(`[QueryFn] Successfully fetched ${data?.length || 0} loras.`);
      return data || [];
    },
  });

  useEffect(() => {
    logger.log(`[Effect Permissions] Running. State: authLoading=${authLoading}, user=${!!user}, checked=${permissionsChecked}, inProgress=${permissionCheckInProgress.current}`);
    if (authLoading) {
      logger.log('[Effect Permissions] Waiting for auth to load.');
      return;
    }
    if (!user) {
        logger.log('[Effect Permissions] No user logged in, skipping permission check.');
        if (permissionsChecked) setPermissionsChecked(false);
        return;
    }
    if (permissionsChecked || permissionCheckInProgress.current) {
        logger.log(`[Effect Permissions] Skipping check: Already checked (${permissionsChecked}) or in progress (${permissionCheckInProgress.current}).`);
        return;
    }
    
    const checkPermissions = async () => {
      logger.log('[Effect Permissions] Starting check for user:', user.id);
      permissionCheckInProgress.current = true;
      try {
        logger.log('Checking user permissions for:', user.id);
        const permissions = await testRLSPermissions();
        logger.log('[Effect Permissions] RLS check result:', permissions);
        setPermissionsChecked(true);
        if (!permissions.assetsAccess || !permissions.mediaAccess) {
          logger.warn('[Effect Permissions] Permission issues detected!');
          toast.error("Permission issues detected. Some data may not be visible.", {
            description: "Try refreshing the data or contact an administrator.",
            duration: 5000
          });
        } else {
            logger.log('[Effect Permissions] RLS check passed.');
        }
      } catch (err) {
        logger.error("[Effect Permissions] Error checking permissions:", err);
      } finally {
        logger.log('[Effect Permissions] Check finished.');
        permissionCheckInProgress.current = false;
      }
    };
    checkPermissions();
  }, [user, permissionsChecked, authLoading]);
  
  const handleNavigateToUpload = useCallback(() => {
    logger.log('Index: Navigating to /upload');
    navigate('/upload');
  }, [navigate]);
  
  const handleRefreshData = useCallback(async () => {
    logger.log('[Manual Refresh] Clicked. Triggering refetchLoras.');
    try {
        await refetchLoras();
        toast.success("LoRAs refreshed.");
    } catch (error) {
        logger.error('[Manual Refresh] Error during refetch:', error);
    }
  }, [refetchLoras]);
  
  const isPageLoading = videosLoading;
  const isActionDisabled = isPageLoading || lorasAreLoadingQuery || authLoading;

  logger.log(`Index rendering return. videosLoading=${videosLoading}, lorasLoading=${lorasAreLoadingQuery}, authLoading=${authLoading}, fetchedLoras count=${fetchedLoras?.length}`);
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <PageHeader 
            title="Curated LoRAs for open video models"
            description="A curated collection of artistically-oriented LoRAs for open source video models like Wan, LTXV and Hunyuan."
            buttonText="Propose New LoRA"
            onButtonClick={handleNavigateToUpload}
            buttonSize={isMobile ? "sm" : "default"}
            buttonDisabled={isActionDisabled} 
          />
          
          <LoraManager 
            loras={fetchedLoras || []} 
            isLoading={isPageLoading} 
            lorasAreLoading={lorasAreLoadingQuery} 
            filterText={filterText}
            onFilterTextChange={setFilterText}
            approvalFilter={approvalFilter}
            onApprovalFilterChange={setApprovalFilter}
            modelFilter={currentModelFilter}
            onModelFilterChange={setCurrentModelFilter}
            isAdmin={isAdmin}
          />
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Index;
