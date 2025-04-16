import React from 'react';
import { LoraCardSkeleton } from './lora/LoraCardSkeleton';

interface LoraGallerySkeletonProps {
  count?: number;
}

/**
 * Renders a grid of LoraCardSkeleton components.
 */
export const LoraGallerySkeleton: React.FC<LoraGallerySkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <LoraCardSkeleton key={index} />
      ))}
    </div>
  );
}; 