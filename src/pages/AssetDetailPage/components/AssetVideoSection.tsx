import React, { useState, useEffect } from 'react';
import { VideoEntry, LoraAsset } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import VideoCard from '@/components/video/VideoCard';
import LoRAVideoUploader from '@/components/lora/LoRAVideoUploader';
import { useAuth } from '@/hooks/useAuth';
import { Logger } from '@/lib/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const logger = new Logger('AssetVideoSection');

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
  const [classification, setClassification] = useState<string>('all');
  
  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    logger.log(`AssetVideoSection: Hover state changed for ${videoId} to ${isHovering}`);
    
    if (isHovering) {
      setHoveredVideoId(videoId);
    } else if (hoveredVideoId === videoId) {
      setHoveredVideoId(null);
    }
  };
  
  const filteredVideos = videos.filter(video => {
    if (classification === 'all') return true;
    return video.metadata?.classification === classification;
  });
  
  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-muted-foreground">Videos made with this:</h2>
        <Select 
          value={classification} 
          onValueChange={setClassification}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Videos</SelectItem>
            <SelectItem value="generation">Generation</SelectItem>
            <SelectItem value="art">Art</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="mb-4">
        <LoRAVideoUploader 
          assetId={asset?.id || ''} 
          assetName={asset?.name || ''} 
          onUploadsComplete={fetchAssetDetails}
          isLoggedIn={!!user}
        />
      </div>
      
      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map(video => (
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
          description={classification === 'all' 
            ? "No videos are currently associated with this LoRA."
            : `No ${classification} videos found for this LoRA.`}
        />
      )}
    </div>
  );
};

export default AssetVideoSection;
