import React, { useState, useEffect, useMemo } from 'react';
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
import Masonry from 'react-masonry-css';
import { DummyCard, generateDummyItems } from '@/components/common/DummyCard';

const logger = new Logger('AssetVideoSection');

// Define breakpoint columns for Masonry
const breakpointColumnsObj = {
  default: 3, // Default to 3 columns
  1100: 3,  // 3 columns for screens >= 1100px
  700: 2,   // 2 columns for screens >= 700px
  500: 1    // 1 column for screens < 500px
};

// Type guard to check if item is a real video
const isVideoEntry = (item: VideoEntry | { type: 'dummy' }): item is VideoEntry => {
  return !('type' in item && item.type === 'dummy');
};

interface AssetVideoSectionProps {
  asset: LoraAsset | null;
  videos: VideoEntry[];
  isAdmin: boolean;
  handleOpenLightbox: (video: VideoEntry) => void;
  handleApproveVideo: (videoId: string) => Promise<void>;
  handleDeleteVideo: (videoId: string) => Promise<void>;
  handleRejectVideo: (videoId: string) => Promise<void>;
  fetchAssetDetails: () => Promise<void>;
  handleSetPrimaryMedia: (mediaId: string) => Promise<void>;
  isAuthorized: boolean;
}

const AssetVideoSection: React.FC<AssetVideoSectionProps> = ({
  asset,
  videos,
  isAdmin,
  handleOpenLightbox,
  handleApproveVideo,
  handleDeleteVideo,
  handleRejectVideo,
  fetchAssetDetails,
  handleSetPrimaryMedia,
  isAuthorized
}) => {
  const { user } = useAuth();
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [classification, setClassification] = useState<'all' | 'generation' | 'art'>('all');
  
  const handleHoverChange = (videoId: string, isHovering: boolean) => {
    logger.log(`Hover change: ${videoId}, ${isHovering}`);
    setHoveredVideoId(isHovering ? videoId : null);
  };
  
  const sortedAndFilteredVideos = useMemo(() => {
    if (!videos) return [];
    
    // Filter first
    let currentVideos = videos;
    if (classification !== 'all') {
      currentVideos = videos.filter(video => {
        const videoClassification = video.metadata?.classification?.toLowerCase();
        if (classification === 'generation') {
          return videoClassification === 'generation';
        }
        if (classification === 'art') {
          return videoClassification === 'art';
        }
        return false;
      });
    }

    // Then sort: primary first, then by creation date
    return currentVideos.sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Newest first
    });
  }, [videos, classification]);

  // --- Add function to get items for page including dummies (simplified, no pagination here) ---
  const getItemsWithDummies = <T extends VideoEntry>(
    allItems: T[]
  ): Array<T | { type: 'dummy'; id: string; colorClass: string }> => {
    // Only add dummy items if the total number of real items is > 4
    // And less than a certain amount to avoid excessive dummies on small sets
    if (allItems.length > 4 && allItems.length < 10) {
      const dummyItems = generateDummyItems(6, allItems.length);
      // Combine real items with the dummy items
      return [...allItems, ...dummyItems];
    } else {
      // Otherwise, just return the real items
      return allItems;
    }
  };
  // --- End Add ---

  const itemsToDisplay = useMemo(() => getItemsWithDummies(sortedAndFilteredVideos), [sortedAndFilteredVideos]);
  
  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-muted-foreground">Videos made with this:</h2>
        <Select 
          value={classification} 
          onValueChange={(value: string) => setClassification(value as 'all' | 'generation' | 'art')}
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
      
      {sortedAndFilteredVideos.length > 0 ? (
        <div className="relative masonry-fade-container pt-6 max-h-[85vh] md:max-h-[70vh] lg:max-h-[85vh]">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {itemsToDisplay.map(item => {
              if (isVideoEntry(item)) {
                return (
                  <VideoCard
                    key={item.id}
                    video={item}
                    isAdmin={isAdmin}
                    isAuthorized={isAuthorized}
                    onOpenLightbox={handleOpenLightbox}
                    onApproveVideo={handleApproveVideo}
                    onDeleteVideo={handleDeleteVideo}
                    onRejectVideo={handleRejectVideo}
                    onSetPrimaryMedia={handleSetPrimaryMedia}
                    isHovering={hoveredVideoId === item.id}
                    onHoverChange={(isHovering) => handleHoverChange(item.id, isHovering)}
                  />
                );
              } else {
                return (
                  <DummyCard
                    key={item.id}
                    id={item.id}
                    colorClass={item.colorClass}
                  />
                );
              }
            })}
          </Masonry>
          <div className="fade-overlay-element"></div>
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
