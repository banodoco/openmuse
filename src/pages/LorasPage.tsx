import React from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useLoraManagement } from '@/hooks/useLoraManagement';
import LoraManager from '@/components/LoraManager';
import { useAuth } from '@/hooks/useAuth';
import { Helmet } from 'react-helmet-async';
import { Logger } from '@/lib/logger';
import { usePersistentToggle } from '@/hooks/usePersistentToggle';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from '@/components/ui/separator';

const logger = new Logger('LorasPage');

const LorasPage: React.FC = () => {
  logger.log('LorasPage component rendering');
  const { user, isLoading: authLoading, isAdmin } = useAuth();

  const [approvalFilter, setApprovalFilter] = usePersistentToggle(
    'lorasPageApprovalFilter', 
    'curated'
  );

  const { 
    loras, 
    isLoading: lorasLoading, 
  } = useLoraManagement({ modelFilter: 'all', approvalFilter: approvalFilter });

  const isPageLoading = lorasLoading || authLoading;

  const pageTitle = approvalFilter === 'all' ? 'All LoRAs' : 'Curated LoRAs';
  const pageDescription = approvalFilter === 'all' 
    ? 'Browse the full collection of LoRAs, including community uploads.'
    : 'Browse the curated collection of high-quality LoRAs.';

  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>{pageTitle} | OpenMuse</title>
        <meta name="description" content={pageDescription} />
      </Helmet>
      <Navigation />
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <PageHeader 
            title={pageTitle}
            description={pageDescription}
          />

          <div className="flex justify-start mt-4 mb-6">
            <ToggleGroup 
              type="single" 
              value={approvalFilter} 
              onValueChange={(value) => {
                if (value === 'curated' || value === 'all') {
                   setApprovalFilter(value);
                }
              }}
              className="bg-muted/50 p-1 rounded-lg"
            >
              <ToggleGroupItem value="curated" aria-label="Toggle curated" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
                Curated
              </ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="Toggle all" className="data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary transition-all px-4 py-1.5">
                All
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator className="mb-8" />
          
          <LoraManager
            loras={loras}
            isLoading={isPageLoading}
            lorasAreLoading={lorasLoading}
            approvalFilter={approvalFilter}
            isAdmin={isAdmin || false}
            showSeeAllLink={false}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LorasPage; 