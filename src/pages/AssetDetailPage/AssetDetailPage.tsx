import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LoraAsset, VideoEntry } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import AssetHeader from './components/AssetHeader';
import AssetInfoCard from './components/AssetInfoCard';
import AssetVideoSection from './components/AssetVideoSection';
import { useAssetDetails } from './hooks/useAssetDetails';
import { useAssetAdminActions } from './hooks/useAssetAdminActions';
import { useAuth } from '@/hooks/useAuth';
import VideoLightbox from '@/components/VideoLightbox';

const logger = new Logger('AssetDetailPage');

function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoEntry | null>(null);
  
  const {
    asset,
    videos,
    isLoading,
    creatorDisplayName,
    getCreatorName,
    fetchAssetDetails,
    setAsset
  } = useAssetDetails(id);
  
  const {
    isApproving,
    handleCurateAsset,
    handleListAsset,
    handleRejectAsset,
  } = useAssetAdminActions(id, setAsset, fetchAssetDetails);
  
  const handleBackClick = () => {
    navigate('/');
  };
  
  const handleOpenLightbox = (video: VideoEntry) => {
    setCurrentVideo(video);
    setLightboxOpen(true);
  };
  
  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setCurrentVideo(null);
  };
  
  const handleApproveVideo = async (videoId: string) => {
    try {
      logger.log(`Approving video: ${videoId}`);
      const { error } = await supabase
        .from('media')
        .update({ admin_approved: 'Curated' })
        .eq('id', videoId);
        
      if (error) throw error;
      await fetchAssetDetails();
    } catch (error) {
      logger.error('Error approving video:', error);
    }
  };
  
  const handleDeleteVideo = async (videoId: string) => {
    try {
      logger.log(`Rejecting video: ${videoId}`);
      const { error } = await supabase
        .from('media')
        .update({ admin_approved: 'Rejected' })
        .eq('id', videoId);
        
      if (error) throw error;
      await fetchAssetDetails();
    } catch (error) {
      logger.error('Error rejecting video:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navigation />
        <div className="flex-1 w-full max-w-6xl mx-auto p-4">
          <div className="flex justify-center items-center h-64">
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <div className="flex-1 w-full max-w-screen-2xl mx-auto p-4">
        {asset && (
          <>
            <AssetHeader 
              asset={asset}
              handleGoBack={handleBackClick}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="lg:col-span-1">
                <AssetInfoCard 
                  asset={asset}
                  creatorDisplayName={creatorDisplayName}
                  isAdmin={isAdmin}
                  isApproving={isApproving}
                  handleCurateAsset={handleCurateAsset}
                  handleListAsset={handleListAsset}
                  handleRejectAsset={handleRejectAsset}
                  getCreatorName={getCreatorName}
                />
              </div>
              
              <div className="lg:col-span-2">
                <AssetVideoSection 
                  asset={asset}
                  videos={videos}
                  isAdmin={isAdmin}
                  handleOpenLightbox={handleOpenLightbox}
                  handleApproveVideo={handleApproveVideo}
                  handleDeleteVideo={handleDeleteVideo}
                  fetchAssetDetails={fetchAssetDetails}
                />
              </div>
            </div>
          </>
        )}
      </div>
      
      {currentVideo && (
        <VideoLightbox
          isOpen={lightboxOpen}
          onClose={handleCloseLightbox}
          videoUrl={currentVideo.video_location}
          title={currentVideo.metadata?.title}
          creator={currentVideo.user_id || currentVideo.metadata?.creatorName}
          thumbnailUrl={currentVideo.metadata?.thumbnailUrl}
          creatorId={currentVideo.user_id}
        />
      )}
      
      <Footer />
    </div>
  );
}

export default AssetDetailPage;
