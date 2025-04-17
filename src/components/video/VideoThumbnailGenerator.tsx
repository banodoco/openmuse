
import { useEffect, useRef, useState } from 'react';
import { getYoutubeVideoId } from '@/lib/utils/videoPreviewUtils';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoThumbnailGenerator');

interface VideoThumbnailGeneratorProps {
  file?: File;
  url?: string;
  onThumbnailGenerated: (thumbnailUrl: string) => void;
  saveThumbnail?: boolean;
  userId?: string;
  forceGenerate?: boolean;
}

const VideoThumbnailGenerator: React.FC<VideoThumbnailGeneratorProps> = ({
  file,
  url,
  onThumbnailGenerated,
  saveThumbnail = false,
  userId,
  forceGenerate = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  const saveThumbnailToStorage = async (dataUrl: string) => {
    if (!userId) return null;

    try {
      const blob = await (await fetch(dataUrl)).blob();
      const thumbnailName = `thumbnails/${userId}/${uuidv4()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('thumbnails')
        .upload(thumbnailName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        logger.error('Thumbnail upload error:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(thumbnailName);

      return publicUrl;
    } catch (error) {
      logger.error('Error saving thumbnail:', error);
      return null;
    }
  };

  useEffect(() => {
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      
      if (videoRef.current) {
        videoRef.current.src = fileUrl;
        videoRef.current.currentTime = 0; // Set to first frame
        videoRef.current.muted = true;
        videoRef.current.preload = 'metadata';
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0; // Ensure we're at the first frame
          }
        };
        
        videoRef.current.onseeked = async () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current?.videoWidth || 640;
            canvas.height = videoRef.current?.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            
            if (ctx && videoRef.current) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              
              let thumbnailUrl = dataUrl;
              if (saveThumbnail && userId) {
                const storedThumbnailUrl = await saveThumbnailToStorage(dataUrl);
                if (storedThumbnailUrl) {
                  thumbnailUrl = storedThumbnailUrl;
                }
              }
              
              onThumbnailGenerated(thumbnailUrl);
            }
          } catch (e) {
            logger.error('Error generating thumbnail:', e);
          }
        };
      }
      
      return () => {
        URL.revokeObjectURL(fileUrl);
      };
    } 
    else if (url) {
      if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const videoId = getYoutubeVideoId(url);
        if (videoId) {
          const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          onThumbnailGenerated(thumbnailUrl);
        }
      } 
      else if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('vimeo.com') && (url.includes('supabase.co') || forceGenerate)) {
        const tempVideo = document.createElement('video');
        tempVideo.crossOrigin = "anonymous";
        tempVideo.src = url;
        tempVideo.muted = true;
        tempVideo.preload = 'metadata';
        
        tempVideo.onloadedmetadata = () => {
          tempVideo.currentTime = 0.1; // First frame
        };
        
        tempVideo.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = tempVideo.videoWidth || 640;
            canvas.height = tempVideo.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              onThumbnailGenerated(dataUrl);
              
              tempVideo.pause();
              tempVideo.src = '';
              tempVideo.load();
            }
          } catch (e) {
            logger.error('Error generating thumbnail:', e);
            
            // Retry logic for temporary errors
            if (retryCount < maxRetries) {
              logger.log(`Retrying thumbnail generation (${retryCount + 1}/${maxRetries})...`);
              setRetryCount(prev => prev + 1);
              // Use a small delay before retrying
              setTimeout(() => {
                tempVideo.currentTime = 0.1;
              }, 500);
            }
          }
        };
        
        tempVideo.onerror = () => {
          logger.error('Error loading video for thumbnail generation');
          
          // Retry with a slight delay for temporary network issues
          if (retryCount < maxRetries) {
            logger.log(`Retrying video load (${retryCount + 1}/${maxRetries})...`);
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              tempVideo.src = url;
              tempVideo.load();
            }, 1000);
          }
        };
        
        tempVideo.load();
      }
    }
  }, [file, url, onThumbnailGenerated, saveThumbnail, userId, retryCount, forceGenerate]);

  return (
    <video 
      ref={videoRef}
      style={{ display: 'none' }}
      muted
      playsInline
    >
      {file && <source src={URL.createObjectURL(file)} />}
    </video>
  );
};

export default VideoThumbnailGenerator;
