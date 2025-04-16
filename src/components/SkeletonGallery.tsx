
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * SkeletonGallery - A placeholder component shown while LoRAs are loading
 * Displays a grid of skeleton cards mimicking the LoRA gallery layout
 */
const SkeletonGallery: React.FC = () => {
  // Create an array to render multiple skeleton items
  const skeletonCount = 8;
  const skeletonItems = Array.from({ length: skeletonCount }).map((_, index) => (
    <div key={index} className="flex flex-col space-y-3">
      {/* Skeleton for the video/image area */}
      <Skeleton className="h-[180px] w-full rounded-md" />
      
      {/* Skeleton for the title */}
      <Skeleton className="h-6 w-3/4" />
      
      {/* Skeleton for description */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      
      {/* Skeleton for additional metadata */}
      <div className="flex space-x-2 pt-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  ));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {skeletonItems}
    </div>
  );
};

export default SkeletonGallery;
