
import React, { useRef, useEffect, memo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from 'lucide-react';
import StorageVideoPlayer from './StorageVideoPlayer';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoLightbox');

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
      if (!creator) {
        setCreatorDisplayName(null);
        return;
      }

      logger.log(`Attempting to fetch display name for creator: ${creator}`);
      
      try {
        // First, try looking up by user_id if it might be a UUID
        if (creator.includes('-') && creator.length > 30) {
          const { data: userById, error: userIdError } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', creator)
            .maybeSingle();
          
          if (userById && !userIdError) {
            logger.log('Found user by ID:', userById);
            setCreatorDisplayName(userById.display_name || userById.username);
            return;
          }
        }
        
        // Next try by exact username match
        const { data: userByUsername, error: usernameError } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('username', creator)
          .maybeSingle();
        
        if (userByUsername && !usernameError) {
          logger.log('Found user by exact username:', userByUsername);
          setCreatorDisplayName(userByUsername.display_name || userByUsername.username);
          return;
        }
        
        // If creator looks like an email, try to find by email directly
        if (creator.includes('@')) {
          const { data: userByEmail, error: emailError } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('email', creator)
            .maybeSingle();
          
          if (userByEmail && !emailError) {
            logger.log('Found user by email:', userByEmail);
            setCreatorDisplayName(userByEmail.display_name || userByEmail.username);
            return;
          }
          
          // Try by partial match on username with the email username part
          const emailUsername = creator.split('@')[0];
          
          const { data: userByPartialMatch, error: partialError } = await supabase
            .from('profiles')
            .select('display_name, username')
            .ilike('username', `%${emailUsername}%`)
            .maybeSingle();
          
          if (userByPartialMatch && !partialError) {
            logger.log('Found user by partial username match:', userByPartialMatch);
            setCreatorDisplayName(userByPartialMatch.display_name || userByPartialMatch.username);
            return;
          }
        }
        
        // If all lookups failed, check if there's a user_id in the media record
        // This last attempt is specifically to handle cases where the creator field may 
        // contain just an email but the media record has the correct user_id
        if (creator.includes('@')) {
          const { data: mediaWithUserId, error: mediaError } = await supabase
            .from('media')
            .select('user_id')
            .eq('creator', creator)
            .maybeSingle();
          
          if (mediaWithUserId?.user_id && !mediaError) {
            const { data: userByMediaId, error: mediaUserError } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', mediaWithUserId.user_id)
              .maybeSingle();
            
            if (userByMediaId && !mediaUserError) {
              logger.log('Found user from media user_id:', userByMediaId);
              setCreatorDisplayName(userByMediaId.display_name || userByMediaId.username);
              return;
            }
          }
        }
        
        // If all else fails, use the creator as is, without email domain if it's an email
        if (creator.includes('@')) {
          setCreatorDisplayName(creator.split('@')[0]);
        } else {
          setCreatorDisplayName(creator);
        }
        
      } catch (error) {
        logger.error('Error fetching creator profile:', error);
        // Fallback to creator name without domain if it's an email
        if (creator.includes('@')) {
          setCreatorDisplayName(creator.split('@')[0]);
        } else {
          setCreatorDisplayName(creator);
        }
      }
    };

    if (isOpen && creator) {
      fetchCreatorDisplayName();
    }
  }, [isOpen, creator]);

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
