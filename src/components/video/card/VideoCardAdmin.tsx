
import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoCardAdminProps {
  adminApproved: string | null;
  onApprove: (e: React.MouseEvent) => void;
  onList: (e: React.MouseEvent) => void;
  onReject: (e: React.MouseEvent) => void;
}

const VideoCardAdmin: React.FC<VideoCardAdminProps> = ({
  adminApproved,
  onApprove,
  onList,
  onReject
}) => {
  const getButtonStyle = (status: string) => {
    const currentStatus = adminApproved || 'Listed';
    const isActive = currentStatus === status;
    
    return cn(
      "text-xs h-6 w-6",
      isActive && status === 'Curated' && "bg-green-500 text-white hover:bg-green-600",
      isActive && status === 'Listed' && "bg-blue-500 text-white hover:bg-blue-600",
      isActive && status === 'Rejected' && "bg-red-500 text-white hover:bg-red-600",
      !isActive && "bg-black/40 hover:bg-black/60 text-white"
    );
  };
  
  return (
    <div className="absolute top-2 right-2 flex space-x-1 z-10">
      <Button 
        variant="secondary" 
        size="icon" 
        className={getButtonStyle('Curated')}
        onClick={onApprove}
        title="Curate video"
      >
        <Check className="h-3 w-3" />
      </Button>
      
      <Button 
        variant="secondary" 
        size="icon" 
        className={getButtonStyle('Listed')}
        onClick={onList}
        title="List video"
      >
        <span className="text-xs font-bold">L</span>
      </Button>
      
      <Button 
        variant="destructive" 
        size="icon" 
        className={getButtonStyle('Rejected')}
        onClick={onReject}
        title="Reject video"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default VideoCardAdmin;
