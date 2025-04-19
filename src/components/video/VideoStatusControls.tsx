
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
      className={cn("absolute z-20 flex gap-1 bg-black/30 backdrop-blur-sm rounded-md p-0.5", className)} 
      onClick={e => {
        logger.log("Container clicked");
        e.stopPropagation();
        e.preventDefault();
      }}
      style={{ pointerEvents: 'all' }}
    >
      <Button 
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 px-2 rounded-sm",
          status === 'Featured' 
            ? "bg-yellow-500/90 text-white hover:bg-yellow-600" 
            : "bg-black/30 text-yellow-400 hover:bg-black/50 hover:text-yellow-300"
        )}
        onClick={handleButtonClick('Featured')}
        style={{ pointerEvents: 'all' }}
      >
        <Bookmark className={cn("h-3 w-3 mr-1", status === 'Featured' && "fill-current")} />
        <span className="text-xs">Featured</span>
      </Button>

      <Button 
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 px-2 rounded-sm",
          status === 'Listed' 
            ? "bg-blue-500/90 text-white hover:bg-blue-600" 
            : "bg-black/30 text-white hover:bg-black/50"
        )}
        onClick={handleButtonClick('Listed')}
        style={{ pointerEvents: 'all' }}
      >
        <Eye className="h-3 w-3 mr-1" />
        <span className="text-xs">Listed</span>
      </Button>

      <Button 
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 px-2 rounded-sm",
          status === 'Hidden' 
            ? "bg-gray-500/90 text-white hover:bg-gray-600" 
            : "bg-black/30 text-gray-400 hover:bg-black/50 hover:text-gray-300"
        )}
        onClick={handleButtonClick('Hidden')}
        style={{ pointerEvents: 'all' }}
      >
        <EyeOff className="h-3 w-3 mr-1" />
        <span className="text-xs">Hide</span>
      </Button>
    </div>
  );
};

export default VideoStatusControls;
