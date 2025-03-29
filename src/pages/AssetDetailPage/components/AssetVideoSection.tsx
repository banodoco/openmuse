
import React, { useState } from 'react';
import { VideoEntry, LoraAsset } from '@/lib/types';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import VideoCard from '@/components/video/VideoCard';
import LoRAVideoUploader from '@/components/lora/LoRAVideoUploader';
import { useAuth } from '@/hooks/useAuth';

interface AssetVideoSectionProps {
  asset: LoraAsset | null;
  videos: VideoEntry[];
  isAdmin: boolean;
  handleOpenLightbox: (video: VideoEntry) => void;
  handleApproveVideo: (videoId: string) => Promise<void>;
  handleDeleteVideo: (videoId: string) => Promise<void>;
  fetchAssetDetails: () => Promise<void>;
}

const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
  asset,
  videos,
  isAdmin,
  handleOpenLightbox,
  handleApproveVideo,
  handleDeleteVideo,
  fetchAssetDetails
}) => {
  const { user } = useAuth();
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  
  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    if (isHovering) {
      setHoveredVideoId(videoId);
    } else if (hoveredVideoId === videoId) {
      setHoveredVideoId(null);
    }
  };
  
  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-muted-foreground">Videos made with this:</h2>
      </div>
      
      <div className="mb-4">
        <LoRAVideoUploader 
          assetId={asset?.id || ''} 
          assetName={asset?.name || ''} 
          onUploadsComplete={fetchAssetDetails}
          isLoggedIn={!!user}
        />
      </div>
      
      {videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              isAdmin={isAdmin}
              onOpenLightbox={handleOpenLightbox}
              onApproveVideo={handleApproveVideo}
              onDeleteVideo={handleDeleteVideo}
              isHovering={hoveredVideoId === video.id}
              onHoverChange={(isHovering) => handleHoverChange(video.id, isHovering)}
            />
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No Videos"
          description="No videos are currently associated with this LoRA."
        />
      )}
    </div>
  );
};

export default AssetVideoSection;
