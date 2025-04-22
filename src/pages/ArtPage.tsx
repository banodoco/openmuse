import React, { useMemo } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import VideoGallerySection from '@/components/video/VideoGallerySection';
import { Helmet } from 'react-helmet-async';
import { Logger } from '@/lib/logger';

const logger = new Logger('ArtPage');

const ArtPage: React.FC = () => {
  logger.log('ArtPage component rendering');
  const { videos, isLoading: videosLoading } = useVideoManagement();

  // Filter for Featured/Curated Art videos
  const artVideos = useMemo(() => 
    videos
      .filter(v => ['Curated', 'Featured'].includes(v.admin_status))
      .filter(v => v.metadata?.classification === 'art'),
    [videos]
  );

  return (
    <div className="flex flex-col min-h-screen">
       <Helmet>
        <title>All Featured Art | OpenMuse</title>
        <meta name="description" content="Browse all featured and curated art videos on OpenMuse." />
      </Helmet>
      <Navigation />
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <PageHeader 
            title="All Featured Art"
            description="Browse the full collection of featured and curated art videos."
          />
          
          <VideoGallerySection
            header="Art Collection" // Use a different header for the page itself
            videos={artVideos}
            isLoading={videosLoading}
            seeAllPath={undefined} // No "See all" link on the all page
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ArtPage; 