
import React from 'react';
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Star } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className={cn(
            "absolute top-2 right-2 z-20 h-7 w-7 p-0 rounded-md shadow-sm",
            "bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm",
            status === 'Featured' && "text-yellow-400 hover:text-yellow-300",
            status === 'Hidden' && "text-red-400 hover:text-red-300",
            className
          )}
        >
          {status === 'Featured' && <Star className="h-4 w-4 fill-current" />}
          {status === 'Listed' && <Eye className="h-4 w-4" />}
          {status === 'Hidden' && <EyeOff className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={() => onStatusChange('Featured')}>
          <Star className="mr-2 h-4 w-4" />
          <span>Featured</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange('Listed')}>
          <Eye className="mr-2 h-4 w-4" />
          <span>Listed</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange('Hidden')}>
          <EyeOff className="mr-2 h-4 w-4" />
          <span>Hidden</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VideoStatusControls;
