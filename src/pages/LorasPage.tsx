import React from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useLoraManagement } from '@/hooks/useLoraManagement';
import LoraManager from '@/components/LoraManager';
import { useAuth } from '@/hooks/useAuth';
import { Helmet } from 'react-helmet-async';
import { Logger } from '@/lib/logger';

const logger = new Logger('LorasPage');

const LorasPage: React.FC = () => {
  logger.log('LorasPage component rendering');
  const { user, isLoading: authLoading, isAdmin } = useAuth();

  // Fetch all LoRAs with 'Featured' or 'Curated' status (same as index page)
  const { 
    loras, 
    isLoading: lorasLoading, 
  } = useLoraManagement({ modelFilter: 'all', approvalFilter: 'all' });

  const isPageLoading = lorasLoading || authLoading;

  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>All Featured LoRAs | OpenMuse</title>
        <meta name="description" content="Browse all featured and curated LoRA assets for open source video models on OpenMuse." />
      </Helmet>
      <Navigation />
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <PageHeader 
            title="All Featured LoRAs"
            description="Browse the full collection of featured and curated LoRAs."
          />
          
          <LoraManager
            loras={loras} // Pass the fetched LoRAs directly
            isLoading={isPageLoading}
            lorasAreLoading={lorasLoading} // Use dedicated loading state
            filterText="" // No initial text filter
            onFilterTextChange={() => {}} // Placeholder, could add filtering later
            modelFilter="all" // Show all models
            onModelFilterChange={() => {}} // Placeholder
            isAdmin={isAdmin || false}
            // No need for upload button or refresh here, simpler view
            showSeeAllLink={false} // Don't show the link on the 'all' page
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LorasPage; 