
import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";

const SkeletonGallery = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 py-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex flex-col">
          <Skeleton className="w-full h-48 rounded-lg mb-4" />
          <Skeleton className="w-full h-6 mb-2" />
          <Skeleton className="w-3/4 h-4 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="w-16 h-6" />
            <Skeleton className="w-16 h-6" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonGallery;
