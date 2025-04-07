
import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import VideoPlayer from '@/components/video/VideoPlayer';

interface VideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
  creator?: string | null;
  thumbnailUrl?: string;
}

const VideoLightbox: React.FC<VideoLightboxProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title,
  creator,
  thumbnailUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-0 bg-background">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-black/50 rounded-full p-2 text-white hover:bg-black/70 transition-all"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          
          <div className="p-4 pt-0">
            <VideoPlayer
              src={videoUrl}
              poster={thumbnailUrl}
              ref={videoRef}
              className="w-full rounded-md"
              controls
              autoPlay
            />
          </div>
          
          <div className="p-4 pt-0">
            {title && (
              <h3 className="text-xl font-semibold">{title}</h3>
            )}
            {creator && (
              <p className="text-sm text-muted-foreground">
                Created by {creator}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoLightbox;
