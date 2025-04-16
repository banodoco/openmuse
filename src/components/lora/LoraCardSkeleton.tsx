import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Renders a skeleton placeholder for a LoraCard.
 */
export const LoraCardSkeleton: React.FC = () => {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      {/* Video Preview Skeleton */}
      <Skeleton className="aspect-video w-full bg-muted" />

      {/* Content Skeleton */}
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          {/* Title Skeleton */}
          <Skeleton className="h-4 w-3/4 bg-muted" />
          {/* Badge Skeleton */}
          <Skeleton className="h-5 w-12 ml-2 bg-muted" />
        </div>
        {/* Creator Skeleton */}
        <Skeleton className="h-3 w-1/2 mt-1 bg-muted" />
      </CardContent>
      {/* No footer skeleton needed as it only appears for admins and isn't essential for layout */}
    </Card>
  );
}; 