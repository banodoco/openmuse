
import React, { useState, useCallback, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import { useLoraManagement } from '@/hooks/useLoraManagement';
import LoraManager from '@/components/LoraManager';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('Index');

const Index = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { user, isLoading: authLoading } = useAuth();
  
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
  
  const handleNavigateToUpload = useCallback(() => {
    navigate('/upload');
  }, [navigate]);
  
  // Determine if we're in a loading state
  const pageIsLoading = authLoading || lorasLoading || isLoading;
  
  // If loading takes too long, force completion
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (pageIsLoading) {
        logger.log('Loading timeout reached, forcing completion');
        setIsLoading(false);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [pageIsLoading]);
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <main className="flex-1 container mx-auto p-4">
        <PageHeader 
          title="LoRAs for open video models"
          description="Discover and contribute to a collection of fine-tuned LoRAs for generating high-quality videos with open source models"
          buttonText="Propose New LoRA"
          onButtonClick={handleNavigateToUpload}
          buttonSize={isMobile ? "sm" : "default"}
          buttonDisabled={pageIsLoading}
        />
        
        <LoraManager 
          loras={displayLoras || []} // Ensure we always pass an array, even if displayLoras is undefined
          isLoading={pageIsLoading}
          refetchLoras={refetchLoras}
        />
      </main>
    </div>
  );
};

export default Index;
