
import React from 'react';
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoStatusControls');

interface VideoStatusControlsProps {
  status: 'Hidden' | 'Listed' | 'Featured';
  onStatusChange: (status: 'Hidden' | 'Listed' | 'Featured') => void;
  className?: string;
}

const VideoStatusControls: React.FC<VideoStatusControlsProps> = ({
  status,
  onStatusChange,
  className
}) => {
  // Prevent click events from propagating to parent elements
  const handleButtonClick = (newStatus: 'Hidden' | 'Listed' | 'Featured') => (e: React.MouseEvent) => {
    logger.log(`Button clicked: ${newStatus}`);
    e.stopPropagation();
    e.preventDefault();
    logger.log(`After stopPropagation for ${newStatus}`);
    onStatusChange(newStatus);
  };

  return (
    <div 
      className={cn("absolute z-50 flex gap-1 bg-black/50 backdrop-blur-sm rounded-md p-1", className)} 
      onClick={e => {
        logger.log("Container clicked");
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
          status === 'Featured' 
            ? "bg-yellow-500/90 text-white hover:bg-yellow-600" 
            : "bg-black/50 text-yellow-400 hover:bg-black/70 hover:text-yellow-300"
        )}
        onClick={handleButtonClick('Featured')}
        title="Feature this video"
      >
        <Bookmark className={cn("h-4 w-4", status === 'Featured' && "fill-current")} />
      </Button>

      <Button 
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-sm",
          status === 'Listed' 
            ? "bg-blue-500/90 text-white hover:bg-blue-600" 
            : "bg-black/50 text-white hover:bg-black/70"
        )}
        onClick={handleButtonClick('Listed')}
        title="List this video"
      >
        <Eye className="h-4 w-4" />
      </Button>

      <Button 
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-sm",
          status === 'Hidden' 
            ? "bg-gray-500/90 text-white hover:bg-gray-600" 
            : "bg-black/50 text-gray-400 hover:bg-black/70 hover:text-gray-300"
        )}
        onClick={handleButtonClick('Hidden')}
        title="Hide this video"
      >
        <EyeOff className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default VideoStatusControls;
