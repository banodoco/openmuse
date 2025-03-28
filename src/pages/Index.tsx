
import React, { useState, useCallback, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import AuthProvider from '@/components/AuthProvider';
import PageHeader from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import { useLoraManagement } from '@/hooks/useLoraManagement';
import LoraManager from '@/components/LoraManager';
import { toast } from 'sonner';

const logger = new Logger('Index');

const Index = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  
  const { 
    loras, 
    isLoading: lorasLoading, 
    refetchLoras
  } = useLoraManagement();
  
  // Show all LoRAs by default
  const displayLoras = React.useMemo(() => {
    logger.log('Total LoRAs available:', loras.length);
    
    if (loras.length === 0) {
      return [];
    }
    
    // Log for debugging
    loras.forEach(lora => {
      logger.log(`LoRA ${lora.id} (${lora.name}): approval status=${lora.admin_approved}, primaryVideo approval=${lora.primaryVideo?.admin_approved}`);
    });
    
    return loras;
  }, [loras]);
  
  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthLoading && lorasLoading) {
        logger.log('Loading timeout reached, forcing completion');
        setIsAuthLoading(false);
      }
    }, 5000); // 5 second timeout
    
    return () => clearTimeout(timer);
  }, [isAuthLoading, lorasLoading]);
  
  const handleNavigateToUpload = useCallback(() => {
    navigate('/upload');
  }, [navigate]);
  
  const handleAuthStateChange = useCallback((isLoading: boolean) => {
    setIsAuthLoading(isLoading);
  }, []);
  
  const isLoading = isAuthLoading || lorasLoading;
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <AuthProvider onAuthStateChange={handleAuthStateChange}>
        <main className="flex-1 container mx-auto p-4">
          <PageHeader 
            title="LoRAs for open video models"
            description="Discover and contribute to a collection of fine-tuned LoRAs for generating high-quality videos with open source models"
            buttonText="Propose New LoRA"
            onButtonClick={handleNavigateToUpload}
            buttonSize={isMobile ? "sm" : "default"}
            buttonDisabled={isLoading}
          />
          
          <LoraManager 
            loras={displayLoras} // Show all LoRAs
            isLoading={isLoading}
            refetchLoras={refetchLoras}
          />
        </main>
      </AuthProvider>
    </div>
  );
};

export default Index;
