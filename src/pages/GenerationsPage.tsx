import React, { useMemo } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { Helmet } from 'react-helmet-async';
import { Logger } from '@/lib/logger';

const logger = new Logger('GenerationsPage');

const GenerationsPage: React.FC = () => {
  logger.log('GenerationsPage component rendering');
  const { videos, isLoading: videosLoading } = useVideoManagement();

  // Filter for Featured/Curated Generation videos
  const generationVideos = useMemo(() => 
    videos
      .filter(v => ['Curated', 'Featured'].includes(v.admin_status))
      .filter(v => v.metadata?.classification !== 'art'), // Assuming anything not 'art' is 'gen'
    [videos]
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>All Featured Generations | OpenMuse</title>
        <meta name="description" content="Browse all featured and curated generation videos on OpenMuse." />
      </Helmet>
      <Navigation />
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <PageHeader 
            title="All Featured Generations"
            description="Browse the full collection of featured and curated generation videos."
          />
          
          <VideoGallerySection
            header="Generations Collection" // Use a different header for the page itself
            videos={generationVideos}
            isLoading={videosLoading}
            seeAllPath={undefined} // No "See all" link on the all page
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default GenerationsPage; 