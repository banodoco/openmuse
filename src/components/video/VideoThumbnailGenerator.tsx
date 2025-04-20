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
  const [hasGeneratedThumbnail, setHasGeneratedThumbnail] = useState(false);
  const thumbnailGenerationAttemptedRef = useRef(false);
  const unmountedRef = useRef(false);
  
  const saveThumbnailToStorage = async (dataUrl: string) => {
    if (!userId) return null;

    try {
      logger.log('Saving thumbnail to storage');
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
      
      logger.log('Thumbnail saved successfully, URL:', publicUrl.substring(0, 50) + '...');
      return publicUrl;
    } catch (error) {
      logger.error('Error saving thumbnail:', error);
      return null;
    }
  };

  useEffect(() => {
    logger.log(`Thumbnail generator mounting. URL: ${url ? url.substring(0, 30) + '...' : 'none'}, File: ${file ? file.name : 'none'}`);
    logger.log(`forceGenerate: ${forceGenerate}, hasGeneratedThumbnail: ${hasGeneratedThumbnail}, attempted: ${thumbnailGenerationAttemptedRef.current}`);
    
    // Set up cleanup function
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);
  
  useEffect(() => {
    // If we've already generated a thumbnail and not forcing, skip
    if (hasGeneratedThumbnail && !forceGenerate) {
      logger.log('Thumbnail already generated and not forcing, skipping generation');
      return;
    }
    
    // Mark that we've attempted generation to avoid duplicates
    if (!thumbnailGenerationAttemptedRef.current) {
      thumbnailGenerationAttemptedRef.current = true;
    }

    const generateFileThumbnail = async () => {
      if (!file || !videoRef.current) return;
      
      logger.log('Processing file for thumbnail generation');
      const fileUrl = URL.createObjectURL(file);
      
      videoRef.current.src = fileUrl;
      videoRef.current.currentTime = 0; // Set to first frame
      videoRef.current.muted = true;
      videoRef.current.preload = 'metadata';
      
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current && !unmountedRef.current) {
          logger.log('Video metadata loaded, seeking to first frame');
          videoRef.current.currentTime = 0; // Ensure we're at the first frame
        }
      };
      
      videoRef.current.onseeked = async () => {
        try {
          // Check if component was unmounted
          if (unmountedRef.current) {
            URL.revokeObjectURL(fileUrl);
            return;
          }
          
          // Check if we already generated a thumbnail
          if (hasGeneratedThumbnail && !forceGenerate) {
            URL.revokeObjectURL(fileUrl);
            return;
          }
          
          logger.log('Video seeked to first frame, generating thumbnail');
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current?.videoWidth || 640;
          canvas.height = videoRef.current?.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          
          if (ctx && videoRef.current) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            let thumbnailUrl = dataUrl;
            if (saveThumbnail && userId) {
              logger.log('Saving file thumbnail to storage');
              const storedThumbnailUrl = await saveThumbnailToStorage(dataUrl);
              if (storedThumbnailUrl) {
                thumbnailUrl = storedThumbnailUrl;
              }
            }
            
            if (!unmountedRef.current) {
              logger.log('File thumbnail generated successfully');
              setHasGeneratedThumbnail(true);
              onThumbnailGenerated(thumbnailUrl);
            }
          }
          
          URL.revokeObjectURL(fileUrl);
        } catch (e) {
          logger.error('Error generating thumbnail from file:', e);
          URL.revokeObjectURL(fileUrl); // Ensure cleanup even on error

          // Only retry if component is still mounted and retries are left
          if (!unmountedRef.current && retryCount < maxRetries) {
            logger.log(`Retrying file thumbnail generation (${retryCount + 1}/${maxRetries})...`);
            // Use a small delay before retrying
            setTimeout(() => {
              if (!unmountedRef.current) {
                // Re-trigger the effect that calls generateFileThumbnail by updating retryCount
                setRetryCount(prev => prev + 1); 
              }
            }, 500 * (retryCount + 1)); // Exponential backoff might be better, but simple delay for now
          }
        }
      };
      
      return () => {
        URL.revokeObjectURL(fileUrl);
      };
    };
    
    const generateUrlThumbnail = async () => {
      if (!url) return;
      
      // Handle YouTube URLs
      if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        logger.log('Processing YouTube URL for thumbnail');
        const videoId = getYoutubeVideoId(url);
        if (videoId) {
          const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          logger.log('YouTube thumbnail URL generated:', thumbnailUrl);
          
          if (!unmountedRef.current) {
            setHasGeneratedThumbnail(true);
            onThumbnailGenerated(thumbnailUrl);
          }
          return;
        }
      } 
      
      // Handle regular video URLs
      if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('vimeo.com') && (url.includes('supabase.co') || forceGenerate)) {
        logger.log('Processing direct video URL for thumbnail generation, URL:', url.substring(0, 30) + '...');
        
        // Check if component was unmounted or thumbnail already generated
        if (unmountedRef.current || (hasGeneratedThumbnail && !forceGenerate)) {
          return;
        }
        
        const tempVideo = document.createElement('video');
        tempVideo.crossOrigin = "anonymous";
        tempVideo.src = url;
        tempVideo.muted = true;
        tempVideo.preload = 'metadata';
        
        tempVideo.onloadedmetadata = () => {
          if (!unmountedRef.current) {
            logger.log('Video metadata loaded, seeking to first frame');
            tempVideo.currentTime = 0.1; // First frame
          }
        };
        
        tempVideo.onseeked = () => {
          try {
            // Check if component was unmounted
            if (unmountedRef.current) {
              tempVideo.pause();
              tempVideo.src = '';
              tempVideo.load();
              return;
            }
            
            // Check if we already generated a thumbnail
            if (hasGeneratedThumbnail && !forceGenerate) {
              tempVideo.pause();
              tempVideo.src = '';
              tempVideo.load();
              return;
            }
            
            logger.log('Video seeked to first frame, generating thumbnail');
            const canvas = document.createElement('canvas');
            canvas.width = tempVideo.videoWidth || 640;
            canvas.height = tempVideo.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              
              if (!unmountedRef.current) {
                logger.log('URL thumbnail generated successfully');
                setHasGeneratedThumbnail(true);
                onThumbnailGenerated(dataUrl);
              }
              
              tempVideo.pause();
              tempVideo.src = '';
              tempVideo.load();
            }
          } catch (e) {
            logger.error('Error generating thumbnail:', e);
            
            // Only retry if component is still mounted
            if (!unmountedRef.current && retryCount < maxRetries) {
              logger.log(`Retrying video load (${retryCount + 1}/${maxRetries})...`);
              setRetryCount(prev => prev + 1);
              setTimeout(() => {
                if (!unmountedRef.current) {
                  tempVideo.src = url;
                  tempVideo.load();
                }
              }, 1000);
            } else {
              tempVideo.pause();
              tempVideo.src = '';
              tempVideo.load();
            }
          }
        };
        
        tempVideo.onerror = () => {
          logger.error('Error loading video for thumbnail generation, URL:', url.substring(0, 30) + '...');
          
          // Only retry if component is still mounted
          if (!unmountedRef.current && retryCount < maxRetries) {
            logger.log(`Retrying video load (${retryCount + 1}/${maxRetries})...`);
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              if (!unmountedRef.current) {
                tempVideo.src = url;
                tempVideo.load();
              }
            }, 1000);
          } else {
            tempVideo.pause();
            tempVideo.src = '';
            tempVideo.load();
          }
        };
        
        tempVideo.load();
      }
    };
    
    // Determine which generation method to use
    if (file) {
      generateFileThumbnail();
    } else if (url) {
      generateUrlThumbnail();
    }
    
    return () => {
      logger.log('Thumbnail generator effect cleanup');
      unmountedRef.current = true;
    };
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
