import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Renders a skeleton placeholder for a LoraCard or VideoCard.
 * Adjusted to better match the typical height of real cards.
 */
export const LoraCardSkeleton: React.FC = () => {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      {/* Video Preview Skeleton */}
      <Skeleton className="aspect-video w-full" />

      {/* Content Skeleton */}
      <CardContent className="p-3 flex-grow flex flex-col">
        <div className="flex items-center justify-between mb-2">
          {/* Title Skeleton */}
          <Skeleton className="h-4 w-3/4" />
          {/* Badge Skeleton (optional representation) */}
          <Skeleton className="h-5 w-10 ml-2 rounded-md" />
        </div>
        {/* Creator/Info Skeleton */}
        <Skeleton className="h-3 w-1/2" />
        <div className="flex-grow"></div>
      </CardContent>
      {/* No footer skeleton needed as it only appears for admins and isn't essential for layout */}
    </Card>
  );
}; 