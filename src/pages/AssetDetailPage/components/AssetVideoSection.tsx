
import React from 'react';
import { VideoEntry, LoraAsset } from '@/lib/types';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import VideoCard from '@/components/video/VideoCard';
import LoRAVideoUploader from '@/components/lora/LoRAVideoUploader';

interface AssetVideoSectionProps {
  asset: LoraAsset | null;
  videos: VideoEntry[];
  isAdmin: boolean;
  showUploadButton: boolean;
  handleOpenLightbox: (video: VideoEntry) => void;
  handleApproveVideo: (videoId: string) => Promise<void>;
  handleDeleteVideo: (videoId: string) => Promise<void>;
  fetchAssetDetails: () => Promise<void>;
}

const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
  asset,
  videos,
  isAdmin,
  showUploadButton,
  handleOpenLightbox,
  handleApproveVideo,
  handleDeleteVideo,
  fetchAssetDetails
}) => {
  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Videos made with this:</h2>
      </div>
      
      {showUploadButton && (
        <div className="mb-4">
          <LoRAVideoUploader 
            assetId={asset?.id || ''} 
            assetName={asset?.name || ''} 
            onUploadsComplete={fetchAssetDetails} 
          />
        </div>
      )}
      
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
