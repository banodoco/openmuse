import React, { useCallback, useEffect, useState, useRef } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import { useLoraManagement } from '@/hooks/useLoraManagement';
import LoraManager from '@/components/LoraManager';
import { useAuth } from '@/hooks/useAuth';
import { testRLSPermissions } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const logger = new Logger('Index');

const Index = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const permissionCheckInProgress = useRef(false);
  const dataRefreshInProgress = useRef(false);
  const initialRefreshDone = useRef(false);
  
  const { 
    loras, 
    isLoading: lorasLoading, 
    refetchLoras
  } = useLoraManagement();
  
  const displayLoras = React.useMemo(() => {
    if (!loras || loras.length === 0) {
      logger.log('No LoRAs available');
      return [];
    }
    
    logger.log('Total LoRAs available:', loras.length);
    
    return loras;
  }, [loras]);
  
  // Add lifecycle logging
  useEffect(() => {
    logger.log('Index page mounted');
    return () => {
      logger.log('Index page unmounting'); // This should fire right before unload
    };
  }, []);
  
  // Only check permissions if user is authenticated and not still loading
  useEffect(() => {
    if (authLoading) {
      // Still determining auth state, wait
      return;
    }
    
    const checkPermissions = async () => {
      if (user && !permissionsChecked && !permissionCheckInProgress.current) {
        permissionCheckInProgress.current = true;
        
        try {
          logger.log('Checking user permissions for:', user.id);
          const permissions = await testRLSPermissions();
          setPermissionsChecked(true);
          
          if (!permissions.assetsAccess || !permissions.mediaAccess) {
            toast.error("Permission issues detected. Some data may not be visible.", {
              description: "Try refreshing the data or contact an administrator.",
              duration: 5000
            });
          }
        } catch (err) {
          logger.error("Error checking permissions:", err);
        } finally {
          permissionCheckInProgress.current = false;
        }
      }
    };
    
    checkPermissions();
    
    return () => {
      logger.log('Index page unloading');
    };
  }, [user, permissionsChecked, authLoading]);
  
  // Refresh data when user is authenticated
  useEffect(() => {
    if (authLoading) {
      // Still determining auth state, wait
      return;
    }
    
    const hasRefreshed = sessionStorage.getItem('initialDataRefreshed') === 'true';
    
    if (user && !lorasLoading && !dataRefreshInProgress.current && !hasRefreshed && !initialRefreshDone.current) {
      logger.log('User is logged in, refreshing LoRAs on mount');
      dataRefreshInProgress.current = true;
      initialRefreshDone.current = true;
      
      const timeoutId = setTimeout(() => {
        refetchLoras().finally(() => {
          dataRefreshInProgress.current = false;
          sessionStorage.setItem('initialDataRefreshed', 'true');
        });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, refetchLoras, lorasLoading, authLoading]);
  
  const handleNavigateToUpload = useCallback(() => {
    navigate('/upload');
  }, [navigate]);
  
  const handleRefreshData = useCallback(async () => {
    if (dataRefreshInProgress.current) {
      logger.log('Data refresh already in progress, skipping');
      return;
    }
    
    dataRefreshInProgress.current = true;
    
    try {
      await refetchLoras();
      logger.log('Data refreshed successfully');
      
      if (!permissionCheckInProgress.current) {
        permissionCheckInProgress.current = true;
        const permissions = await testRLSPermissions();
        setPermissionsChecked(true);
        
        if (!permissions.assetsAccess || !permissions.mediaAccess) {
          toast.error("Permission issues detected. Some data may not be visible.", {
            description: "Try refreshing the data or contact an administrator.",
            duration: 5000
          });
        }
        
        permissionCheckInProgress.current = false;
      }
    } catch (error) {
      logger.error('Error refreshing data:', error);
    } finally {
      dataRefreshInProgress.current = false;
    }
  }, [refetchLoras]);
  
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
            buttonDisabled={lorasLoading || authLoading}
          />
          
          <LoraManager 
            loras={displayLoras} 
            isLoading={lorasLoading || authLoading}
          />
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Index;
