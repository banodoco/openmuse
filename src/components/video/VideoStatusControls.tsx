import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { VideoDisplayStatus } from '@/lib/types';

const logger = new Logger('VideoStatusControls');

interface VideoStatusControlsProps {
  status: VideoDisplayStatus | null | undefined;
  onStatusChange: (status: VideoDisplayStatus) => void;
  className?: string;
}

const VideoStatusControls: React.FC<VideoStatusControlsProps> = ({
  status,
  onStatusChange,
  className
}) => {
  const [currentStatus, setCurrentStatus] = useState<VideoDisplayStatus | null>(status || null);
  const [updateInProgress, setUpdateInProgress] = useState(false);

  useEffect(() => {
    setCurrentStatus(status || null);
  }, [status]);

  const handleButtonClick = (newStatus: VideoDisplayStatus) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onStatusChange(newStatus);
  };

  return (
    <div
      className={cn("flex gap-1 bg-black/50 backdrop-blur-sm rounded-md p-1", className)}
      onClick={e => {
        e.stopPropagation();
        e.preventDefault();
      }}
      style={{ pointerEvents: 'all' }}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-sm",
          currentStatus === 'Hidden'
            ? "bg-gray-500/90 text-white hover:bg-gray-600"
            : "bg-black/50 text-gray-400 hover:bg-black/70 hover:text-gray-300"
        )}
        onClick={handleButtonClick('Hidden')}
        title="Hide this video"
      >
        <EyeOff className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-sm",
          currentStatus === 'Listed'
            ? "bg-blue-500/90 text-white hover:bg-blue-600"
            : "bg-black/50 text-white hover:bg-black/70"
        )}
        onClick={handleButtonClick('Listed')}
        title="Make visible (Listed)"
      >
        <Eye className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-sm",
          currentStatus === 'Pinned'
            ? "bg-yellow-500/90 text-white hover:bg-yellow-600"
            : "bg-black/50 text-yellow-400 hover:bg-black/70 hover:text-yellow-300"
        )}
        onClick={handleButtonClick('Pinned')}
        title="Pin this video"
      >
        <Pin className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default VideoStatusControls;
