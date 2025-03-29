
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
}

const VideoThumbnailGenerator: React.FC<VideoThumbnailGeneratorProps> = ({
  file,
  url,
  onThumbnailGenerated,
  saveThumbnail = false,
  userId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const saveThumbnailToStorage = async (dataUrl: string) => {
    if (!userId) return null;

    try {
      logger.log('Saving thumbnail to storage...');
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

      logger.log(`Thumbnail saved with public URL: ${publicUrl.substring(0, 50)}...`);
      return publicUrl;
    } catch (error) {
      logger.error('Error saving thumbnail:', error);
      return null;
    }
  };

  useEffect(() => {
    if (file) {
      logger.log('Generating thumbnail from file...');
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
                  logger.log('Using stored thumbnail URL');
                }
              }
              
              logger.log('Thumbnail generated successfully');
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
          logger.log(`Using YouTube thumbnail: ${thumbnailUrl}`);
          onThumbnailGenerated(thumbnailUrl);
        }
      } 
      else if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('vimeo.com') && url.includes('supabase.co')) {
        logger.log('Generating thumbnail from Supabase video URL...');
        const tempVideo = document.createElement('video');
        tempVideo.crossOrigin = "anonymous";
        tempVideo.src = url;
        tempVideo.muted = true;
        tempVideo.preload = 'metadata';
        
        tempVideo.onloadedmetadata = () => {
          logger.log('Video metadata loaded, seeking to first frame');
          tempVideo.currentTime = 0.1;
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
              logger.log('Thumbnail generated from video URL');
              onThumbnailGenerated(dataUrl);
              
              tempVideo.pause();
              tempVideo.src = '';
              tempVideo.load();
            }
          } catch (e) {
            logger.error('Error generating thumbnail:', e);
          }
        };
        
        tempVideo.onerror = () => {
          logger.error('Error loading video for thumbnail generation');
        };
        
        tempVideo.load();
      }
    }
  }, [file, url, onThumbnailGenerated, saveThumbnail, userId]);

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
