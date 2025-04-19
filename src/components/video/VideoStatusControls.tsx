
import React from 'react';
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <div className={cn("absolute z-20 flex gap-2", className)}>
      <Button 
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 p-0 rounded-md shadow-sm",
          "bg-black/50 hover:bg-black/70 backdrop-blur-sm",
          status === 'Featured' 
            ? "bg-yellow-500/70 text-white hover:bg-yellow-600/70" 
            : "text-yellow-400 hover:text-yellow-300"
        )}
        onClick={() => onStatusChange('Featured')}
      >
        <Star className={cn("h-4 w-4", status === 'Featured' && "fill-current")} />
      </Button>

      <Button 
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 p-0 rounded-md shadow-sm",
          "bg-black/50 hover:bg-black/70 backdrop-blur-sm",
          status === 'Listed' 
            ? "bg-blue-500/70 text-white hover:bg-blue-600/70" 
            : "text-white hover:text-white/80"
        )}
        onClick={() => onStatusChange('Listed')}
      >
        <Eye className="h-4 w-4" />
      </Button>

      <Button 
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 p-0 rounded-md shadow-sm",
          "bg-black/50 hover:bg-black/70 backdrop-blur-sm",
          status === 'Hidden' 
            ? "bg-gray-500/70 text-white hover:bg-gray-600/70" 
            : "text-gray-400 hover:text-gray-300"
        )}
        onClick={() => onStatusChange('Hidden')}
      >
        <EyeOff className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default VideoStatusControls;
