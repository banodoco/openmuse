
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
  const [hasGeneratedThumbnail, setHasGeneratedThumbnail] = useState(false);
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

  // Generate thumbnail from video element
  const generateThumbnail = async (videoElement: HTMLVideoElement) => {
    if (hasGeneratedThumbnail) return; // Prevent generating multiple times
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        let thumbnailUrl = dataUrl;
        if (saveThumbnail && userId) {
          const storedThumbnailUrl = await saveThumbnailToStorage(dataUrl);
          if (storedThumbnailUrl) {
            thumbnailUrl = storedThumbnailUrl;
          }
        }
        
        setHasGeneratedThumbnail(true);
        onThumbnailGenerated(thumbnailUrl);
      }
    } catch (e) {
      logger.error('Error generating thumbnail:', e);
    }
  };

  useEffect(() => {
    // Reset the state when inputs change
    setHasGeneratedThumbnail(false);
    setRetryCount(0);
    
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
          if (hasGeneratedThumbnail) return;
          await generateThumbnail(videoRef.current!);
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
          if (!hasGeneratedThumbnail) {
            setHasGeneratedThumbnail(true);
            onThumbnailGenerated(thumbnailUrl);
          }
        }
      } 
      else if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('vimeo.com') && (url.includes('supabase.co') || forceGenerate)) {
        // Don't proceed if we already have a thumbnail
        if (hasGeneratedThumbnail) return;
        
        const tempVideo = document.createElement('video');
        tempVideo.crossOrigin = "anonymous";
        tempVideo.src = url;
        tempVideo.muted = true;
        tempVideo.preload = 'metadata';
        
        tempVideo.onloadedmetadata = () => {
          tempVideo.currentTime = 0.1; // First frame
        };
        
        tempVideo.onseeked = () => {
          if (hasGeneratedThumbnail) return;
          generateThumbnail(tempVideo);
          
          // Clean up after successful generation
          tempVideo.pause();
          tempVideo.src = '';
          tempVideo.load();
        };
        
        tempVideo.onerror = () => {
          logger.error('Error loading video for thumbnail generation');
          
          // Retry with a slight delay for temporary network issues
          if (retryCount < maxRetries) {
            logger.log(`Retrying video load (${retryCount + 1}/${maxRetries})...`);
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              if (!hasGeneratedThumbnail) {
                tempVideo.src = url;
                tempVideo.load();
              }
            }, 1000);
          }
        };
        
        tempVideo.load();
      }
    }
  }, [file, url, onThumbnailGenerated, saveThumbnail, userId, retryCount, forceGenerate, hasGeneratedThumbnail]);

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
