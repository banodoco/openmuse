import React, { useCallback, useEffect, useState, useRef } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import { useLoraManagement } from '@/hooks/useLoraManagement';
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
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  logger.log(`Index: useAuth() state - user: ${user?.id || 'null'}, authLoading: ${authLoading}, isAdmin: ${isAdmin}`);

  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const permissionCheckInProgress = useRef(false);
  const dataRefreshInProgress = useRef(false);
  const initialRefreshDone = useRef(false);
  
  // Get video loading state
  const { isLoading: videosLoading } = useVideoManagement();
  logger.log(`Index: useVideoManagement() state - videosLoading: ${videosLoading}`);
  
  // Get model filter from URL query params
  const [searchParams, setSearchParams] = useSearchParams();
  const modelFilterFromUrl = searchParams.get('model') || 'all';
  logger.log(`Index: Model filter from URL: ${modelFilterFromUrl}`);
  
  // LIFTED STATE:
  const [approvalFilter, setApprovalFilter] = useState('curated');
  const [currentModelFilter, setCurrentModelFilter] = useState(modelFilterFromUrl);
  const [filterText, setFilterText] = useState('');

  // Pass filters to the hook
  const { 
    loras, 
    isLoading: lorasLoading, 
    refetchLoras
  } = useLoraManagement({ modelFilter: currentModelFilter, approvalFilter });
  logger.log(`Index: useLoraManagement() state - lorasLoading: ${lorasLoading}, loras count: ${loras?.length || 0}`);
  
  // Client-side filtering for TEXT only
  const displayLoras = React.useMemo(() => {
    logger.log('[Memo displayLoras] Calculating text filter...');
    if (!loras || loras.length === 0) {
      logger.log('[Memo displayLoras] No LoRAs available (post-backend-filter), returning empty array.');
      return [];
    }
    
    if (!filterText) {
      logger.log('[Memo displayLoras] No text filter applied, returning all loras from hook.');
      return loras; // Return all if no text filter
    }

    const filtered = loras.filter(lora => 
      lora.name?.toLowerCase().includes(filterText.toLowerCase()) ||
      lora.creator?.toLowerCase().includes(filterText.toLowerCase())
    );
    logger.log(`[Memo displayLoras] Applying text filter '${filterText}', count: ${filtered.length}`);
    return filtered;

  }, [loras, filterText]); // Only depend on loras (from hook) and filterText
  
  // Add lifecycle logging
  useEffect(() => {
    logger.log('[Effect Lifecycle] Index page mounted');
    return () => {
      logger.log('[Effect Lifecycle] Index page unmounting'); // This should fire right before unload
    };
  }, []);
  
  // Only check permissions if user is authenticated and not still loading
  useEffect(() => {
    logger.log(`[Effect Permissions] Running. State: authLoading=${authLoading}, user=${!!user}, checked=${permissionsChecked}, inProgress=${permissionCheckInProgress.current}`);
    if (authLoading) {
      logger.log('[Effect Permissions] Waiting for auth to load.');
      return;
    }
    if (!user) {
        logger.log('[Effect Permissions] No user logged in, skipping permission check.');
        // Ensure checked is false if user logs out
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
        // Should we mark as checked on error? Maybe not, allow retry later?
        // setPermissionsChecked(true);
      } finally {
        logger.log('[Effect Permissions] Check finished.');
        permissionCheckInProgress.current = false;
      }
    };
    
    checkPermissions();
    
    return () => {
      logger.log('Index page unloading');
    };
  }, [user, permissionsChecked, authLoading]);
  
  // Refresh data when user is authenticated
  useEffect(() => {
    logger.log(`[Effect Initial Refresh] Running. State: authLoading=${authLoading}, user=${!!user}, lorasLoading=${lorasLoading}, refreshInProgress=${dataRefreshInProgress.current}, initialDone=${initialRefreshDone.current}`);
    if (authLoading) {
       logger.log('[Effect Initial Refresh] Waiting for auth.');
       return;
    }
    if (!user) {
       logger.log('[Effect Initial Refresh] No user, skipping initial refresh.');
       // Reset flag if user logs out?
       // initialRefreshDone.current = false; // Consider if this is needed
       // sessionStorage.removeItem('initialDataRefreshed'); // Also maybe clear session storage
       return;
    }

    const hasRefreshedSession = sessionStorage.getItem('initialDataRefreshed') === 'true';
    logger.log(`[Effect Initial Refresh] Session storage 'initialDataRefreshed': ${hasRefreshedSession}`);

    if (!lorasLoading && !dataRefreshInProgress.current && !hasRefreshedSession && !initialRefreshDone.current) {
      logger.log('[Effect Initial Refresh] Conditions met: User logged in, not loading, not in progress, not refreshed yet. Triggering refetchLoras with timeout.');
      dataRefreshInProgress.current = true;
      initialRefreshDone.current = true; // Mark as done for this component instance

      const timeoutId = setTimeout(() => {
        logger.log('[Effect Initial Refresh] Timeout executed, calling refetchLoras()');
        refetchLoras().finally(() => {
          logger.log('[Effect Initial Refresh] refetchLoras() finished. Setting refreshInProgress=false and session storage.');
          dataRefreshInProgress.current = false;
          sessionStorage.setItem('initialDataRefreshed', 'true'); // Mark as done in session storage
        });
      }, 100); // Short delay

      return () => {
          logger.log('[Effect Initial Refresh] Cleanup: Clearing timeout.');
          clearTimeout(timeoutId);
          // Should we reset dataRefreshInProgress here? Probably not, let the finally block handle it.
      };
    } else {
        logger.log('[Effect Initial Refresh] Conditions not met, skipping timed refresh.');
    }
  }, [user, refetchLoras, lorasLoading, authLoading]);
  
  const handleNavigateToUpload = useCallback(() => {
    logger.log('Index: Navigating to /upload');
    navigate('/upload');
  }, [navigate]);
  
  const handleRefreshData = useCallback(async () => {
    logger.log('[Manual Refresh] Clicked.');
    if (dataRefreshInProgress.current) {
      logger.log('[Manual Refresh] Skipping: Refresh already in progress.');
      return;
    }
    logger.log('[Manual Refresh] Starting refresh...');
    dataRefreshInProgress.current = true;
    
    try {
      await refetchLoras();
      logger.log('[Manual Refresh] LoRA refresh successful.');
      
      // Re-check permissions after refresh
      if (user && !permissionCheckInProgress.current) {
        logger.log('[Manual Refresh] Starting post-refresh permission check.');
        permissionCheckInProgress.current = true;
        const permissions = await testRLSPermissions();
        setPermissionsChecked(true);
        logger.log('[Manual Refresh] Post-refresh RLS check result:', permissions);
        if (!permissions.assetsAccess || !permissions.mediaAccess) {
           logger.warn('[Manual Refresh] Permission issues detected after refresh!');
          toast.error("Permission issues detected. Some data may not be visible.", {
            description: "Try refreshing the data or contact an administrator.",
            duration: 5000
          });
        }
        permissionCheckInProgress.current = false;
         logger.log('[Manual Refresh] Post-refresh permission check finished.');
      } else {
          logger.log('[Manual Refresh] Skipping post-refresh permission check (no user or check already in progress).');
      }
    } catch (error) {
      logger.error('[Manual Refresh] Error during refresh:', error);
      // Assuming refetchLoras shows its own toast on error
    } finally {
      logger.log('[Manual Refresh] Refresh finished.');
      dataRefreshInProgress.current = false;
    }
  }, [refetchLoras, user]); // Added user dependency
  
  logger.log(`Index rendering return. videosLoading=${videosLoading}, lorasLoading=${lorasLoading}, authLoading=${authLoading}, displayLoras count=${displayLoras.length}`);
  // Page loading state now depends on videos finishing
  const isPageLoading = videosLoading;
  // Actions might still be disabled if auth or LoRAs are loading (prevent interaction with incomplete data)
  const isActionDisabled = videosLoading || lorasLoading || authLoading;

  // Update URL when model filter changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentModelFilter === 'all') {
      params.delete('model');
    } else {
      params.set('model', currentModelFilter);
    }
    // Use replace: true to avoid adding history entries for filter changes
    setSearchParams(params, { replace: true }); 
  }, [currentModelFilter, searchParams, setSearchParams]);

  // Update local model filter state if URL changes directly
  useEffect(() => {
    setCurrentModelFilter(modelFilterFromUrl);
  }, [modelFilterFromUrl]);

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
            buttonDisabled={isActionDisabled} // Use combined disabled state
          />
          
          <LoraManager 
            loras={displayLoras} // Pass loras filtered by backend + text filter
            isLoading={isPageLoading} 
            lorasAreLoading={lorasLoading} 
            // Pass down lifted state and setters
            filterText={filterText}
            approvalFilter={approvalFilter}
            modelFilter={currentModelFilter}
            onFilterTextChange={setFilterText}
            onApprovalFilterChange={setApprovalFilter}
            onModelFilterChange={setCurrentModelFilter}
          />
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Index;
