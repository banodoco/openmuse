
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';

interface VideoFilterProps {
  videoFilter: string;
  setVideoFilter: (filter: string) => void;
  onRefresh: () => void;
  isDisabled?: boolean;
  isAdmin?: boolean;
}

const VideoFilter: React.FC<VideoFilterProps> = ({
  videoFilter,
  setVideoFilter,
  onRefresh,
  isDisabled = false,
  isAdmin = false
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex gap-2 items-center">
        <Select
          value={videoFilter}
          onValueChange={setVideoFilter}
          disabled={isDisabled}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="curated">Curated Videos</SelectItem>
            <SelectItem value="listed">Listed Videos</SelectItem>
            {isAdmin && (
              <SelectItem value="rejected">Rejected Videos</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isDisabled}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
};

export default VideoFilter;
