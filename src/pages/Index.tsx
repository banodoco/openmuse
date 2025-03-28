
import React, { useState, useCallback, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import { useLoraManagement } from '@/hooks/useLoraManagement';
import LoraManager from '@/components/LoraManager';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('Index');

const Index = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { 
    loras, 
    isLoading: lorasLoading, 
    refetchLoras
  } = useLoraManagement();
  
  // Show all LoRAs by default
  const displayLoras = React.useMemo(() => {
    if (!loras || loras.length === 0) {
      logger.log('No LoRAs available');
      return [];
    }
    
    logger.log('Total LoRAs available:', loras.length);
    
    // Log for debugging
    loras.forEach(lora => {
      logger.log(`LoRA ${lora.id} (${lora.name}): approval status=${lora.admin_approved}, primaryVideo approval=${lora.primaryVideo?.admin_approved}`);
    });
    
    return loras;
  }, [loras]);
  
  const handleNavigateToUpload = useCallback(() => {
    navigate('/upload');
  }, [navigate]);
  
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
          buttonDisabled={lorasLoading}
        />
        
        <LoraManager 
          loras={displayLoras} 
          isLoading={lorasLoading}
          refetchLoras={refetchLoras}
        />
      </main>
    </div>
  );
};

export default Index;
