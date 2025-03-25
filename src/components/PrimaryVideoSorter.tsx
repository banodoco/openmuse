
import React from 'react';
import { VideoEntry } from '@/lib/types';

interface PrimaryVideoSorterProps {
  videos: VideoEntry[];
  render: (sortedVideos: VideoEntry[]) => React.ReactNode;
}

const PrimaryVideoSorter: React.FC<PrimaryVideoSorterProps> = ({ 
  videos, 
  render 
}) => {
  // Sort videos to put primary ones first
  const sortedVideos = [...videos].sort((a, b) => {
    // Primary videos first
    const aPrimary = a.metadata?.isPrimary === true;
    const bPrimary = b.metadata?.isPrimary === true;
    
    if (aPrimary && !bPrimary) return -1;
    if (!aPrimary && bPrimary) return 1;
    
    // Then by creation date (newest first)
    const aDate = new Date(a.created_at).getTime();
    const bDate = new Date(b.created_at).getTime();
    return bDate - aDate;
  });

  return <>{render(sortedVideos)}</>;
};

export default PrimaryVideoSorter;
