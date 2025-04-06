
import React, { useRef, useEffect, memo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from 'lucide-react';
import StorageVideoPlayer from './StorageVideoPlayer';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { supabase } from '@/integrations/supabase/client';

interface VideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
  creator?: string;
  thumbnailUrl?: string;
}

const VideoLightbox: React.FC<VideoLightboxProps> = memo(({
  isOpen,
  onClose,
  videoUrl,
  title,
  creator,
  thumbnailUrl
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [playTriggered, setPlayTriggered] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the creator's display name when the component mounts or creator changes
    const fetchCreatorDisplayName = async () => {
      if (creator) {
        try {
          // Try to get the profile information based on username or email
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, username')
            .or(`username.eq.${creator},email.eq.${creator}`)
            .maybeSingle();
          
          if (data && !error) {
            setCreatorDisplayName(data.display_name || data.username);
          } else {
            // If no profile found, use the basic email formatting
            setCreatorDisplayName(getFormattedCreatorName(creator));
          }
        } catch (error) {
          console.error('Error fetching creator profile:', error);
          setCreatorDisplayName(getFormattedCreatorName(creator));
        }
      } else {
        setCreatorDisplayName(null);
      }
    };

    if (isOpen && creator) {
      fetchCreatorDisplayName();
    }
  }, [isOpen, creator]);

  const getFormattedCreatorName = (creatorName?: string) => {
    if (!creatorName) return 'Unknown Creator';
    
    if (creatorName.includes('@')) {
      return creatorName.split('@')[0];
    }
    
    return creatorName;
  };

  useEffect(() => {
    if (isOpen) {
      setIsVideoReady(false);
      setPlayTriggered(false);
    }
  }, [isOpen, videoUrl]);

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

  useEffect(() => {
    if (!isOpen && playerRef.current) {
      playerRef.current.pause();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isVideoReady && playerRef.current && !playTriggered) {
      console.log('Attempting to play video in lightbox after ready event');
      
      const playTimeout = setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.play()
            .then(() => {
              console.log('Video playback started successfully');
              setPlayTriggered(true);
            })
            .catch(err => {
              console.error('Failed to play video in lightbox:', err);
              setTimeout(() => {
                if (playerRef.current && isOpen) {
                  playerRef.current.play()
                    .catch(e => console.error('Retry failed:', e));
                }
              }, 300);
            });
        }
      }, 200);
      
      return () => clearTimeout(playTimeout);
    }
  }, [isOpen, isVideoReady, playTriggered]);

  const handleVideoReady = () => {
    console.log('Video reported as ready in lightbox');
    setIsVideoReady(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-screen-lg w-[90vw] p-0 bg-background border-none" 
        ref={contentRef} 
        aria-describedby="video-content-description"
      >
        <DialogTitle className="sr-only">
          {title || "Video Preview"}
        </DialogTitle>
        
        <div id="video-content-description" className="sr-only">
          {creator ? `Video by ${creator}` : "Video preview content"}
        </div>
        
        <div className="relative">
          <button 
            className="absolute top-2 right-2 z-50 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            onClick={onClose}
            aria-label="Close video preview"
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
              loop={false}
              playOnHover={false}
              videoRef={playerRef}
              onLoadedData={handleVideoReady}
              lazyLoad={false}
              thumbnailUrl={thumbnailUrl}
            />
          </div>
          {(title || creatorDisplayName) && (
            <div className="p-4 bg-black/10">
              {title && <h3 className="text-lg font-medium">{title}</h3>}
              {creatorDisplayName && <p className="text-sm text-muted-foreground">By {creatorDisplayName}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

VideoLightbox.displayName = 'VideoLightbox';

export default VideoLightbox;
