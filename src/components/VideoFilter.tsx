
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
      <div className="flex-1">
        <Select
          value={videoFilter}
          onValueChange={setVideoFilter}
          disabled={isDisabled}
        >
          <SelectTrigger className="max-w-[200px]">
            <SelectValue placeholder="Filter videos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Videos</SelectItem>
            <SelectItem value="curated">Curated</SelectItem>
            <SelectItem value="listed">Listed</SelectItem>
            {isAdmin && (
              <SelectItem value="rejected">Rejected</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isDisabled}
        className={cn("gap-2", isDisabled && "opacity-50 cursor-not-allowed")}
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
};

export default VideoFilter;
