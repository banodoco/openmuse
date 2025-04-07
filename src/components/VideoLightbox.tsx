import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import VideoPlayer from '@/components/video/VideoPlayer';
import { supabase } from '@/integrations/supabase/client';

interface VideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
  creator?: string | null;
  thumbnailUrl?: string;
  creatorId?: string;
}

const VideoLightbox: React.FC<VideoLightboxProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title,
  creator,
  thumbnailUrl,
  creatorId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreatorDisplayName = async () => {
      if (creatorId) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', creatorId)
            .maybeSingle();
          
          if (profile && !error) {
            setCreatorDisplayName(profile.display_name || profile.username);
          }
        } catch (error) {
          console.error('Error fetching creator profile:', error);
        }
      }
    };

    if (isOpen) {
      fetchCreatorDisplayName();
    }
  }, [creatorId, isOpen]);

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
              className="w-full rounded-md"
              controls
              autoPlay
            />
          </div>
          
          <div className="p-4 pt-0">
            {title || creatorDisplayName ? (
              <div className="text-xl font-semibold">
                {title || (creatorDisplayName && `By ${creatorDisplayName}`)}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoLightbox;
