
import React, { useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import StorageVideoPlayer from './StorageVideoPlayer';

interface VideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
  creator?: string;
}

const VideoLightbox: React.FC<VideoLightboxProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title,
  creator
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Add keyboard event handler for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-screen-lg w-[90vw] p-0 bg-background border-none" ref={contentRef}>
        <div className="relative">
          <button 
            className="absolute top-2 right-2 z-50 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="aspect-video w-full">
            <StorageVideoPlayer
              videoLocation={videoUrl}
              controls={true}
              muted={false}
              className="w-full h-full"
              autoPlay={true}
            />
          </div>
          {(title || creator) && (
            <div className="p-4 bg-black/10">
              {title && <h3 className="text-lg font-medium">{title}</h3>}
              {creator && <p className="text-sm text-muted-foreground">By {creator}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoLightbox;
