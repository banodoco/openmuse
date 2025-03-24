
import React from 'react';
import { Button } from "@/components/ui/button";

interface VideoFilterProps {
  videoFilter: string;
  setVideoFilter: (filter: string) => void;
  onRefresh: () => void;
  isDisabled: boolean;
}

const VideoFilter: React.FC<VideoFilterProps> = ({ 
  videoFilter, 
  setVideoFilter, 
  onRefresh, 
  isDisabled 
}) => {
  return (
    <div className="mb-4 flex items-center gap-2">
      <select 
        className="p-2 border rounded-md bg-background"
        value={videoFilter}
        onChange={(e) => setVideoFilter(e.target.value)}
        disabled={isDisabled}
      >
        <option value="all">All Videos</option>
        <option value="approved">Approved Videos</option>
        <option value="pending">Pending Videos</option>
      </select>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRefresh}
        disabled={isDisabled}
      >
        Refresh
      </Button>
    </div>
  );
};

export default VideoFilter;
