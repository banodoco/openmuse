import { useEffect, useRef, useState } from 'react';
import { getYoutubeVideoId } from '@/lib/utils/videoPreviewUtils';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoThumbnailGenerator');

interface VideoThumbnailGeneratorProps {
  file?: File;
  url?: string;
  onSuccess: (thumbnailUrl: string) => void;
  saveThumbnail?: boolean;
  userId?: string;
  forceGenerate?: boolean;
  onFailure?: () => void;
}

const VideoThumbnailGenerator: React.FC<VideoThumbnailGeneratorProps> = ({
  file,
  url,
  onSuccess,
  saveThumbnail = false,
  userId,
  forceGenerate = false,
  onFailure
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [hasGeneratedThumbnail, setHasGeneratedThumbnail] = useState(false);
  const thumbnailGenerationAttemptedRef = useRef(false);
  const unmountedRef = useRef(false);
  const componentIdRef = useRef(`thumb_gen_${Math.random().toString(36).substring(2, 9)}`);
  const componentId = componentIdRef.current;
  
  logger.log(`[${componentId}] VideoThumbnailGenerator instance created.`);
  
  const saveThumbnailToStorage = async (dataUrl: string) => {
    logger.log(`[${componentId}] saveThumbnailToStorage called.`);
    if (!userId) {
      logger.warn(`[${componentId}] Cannot save thumbnail, userId is missing.`);
      return null;
    }

    try {
      logger.log(`[${componentId}] Fetching data URL blob...`);
      const blob = await (await fetch(dataUrl)).blob();
      const thumbnailName = `thumbnails/${userId}/${uuidv4()}.jpg`;
      logger.log(`[${componentId}] Generated thumbnail name: ${thumbnailName}`);
      
      logger.log(`[${componentId}] Calling Supabase storage upload...`);
      const { data, error } = await supabase.storage
        .from('thumbnails')
        .upload(thumbnailName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        logger.error(`[${componentId}] Supabase storage upload error:`, error);
        onFailure?.();
        return null;
      }
      logger.log(`[${componentId}] Supabase storage upload successful. Data:`, data);

      logger.log(`[${componentId}] Getting public URL...`);
      const { data: { publicUrl } } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(thumbnailName);
      
      logger.log(`[${componentId}] Thumbnail saved successfully, Public URL:`, publicUrl ? publicUrl.substring(0, 50) + '...' : 'null');
      return publicUrl;
    } catch (error) {
      logger.error(`[${componentId}] Error saving thumbnail (catch block):`, error);
      onFailure?.();
      return null;
    }
  };

  useEffect(() => {
    logger.log(`[${componentId}] Mounting/Effect run. Props: url=${url ? url.substring(0, 30)+'...' : 'none'}, file=${file ? file.name : 'none'}, forceGenerate=${forceGenerate}, saveThumbnail=${saveThumbnail}, userId=${userId}`);
    logger.log(`[${componentId}] Initial State: hasGeneratedThumbnail=${hasGeneratedThumbnail}, attempted=${thumbnailGenerationAttemptedRef.current}`);
    
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
              } else {
                logger.warn(`[${componentId}] saveThumbnailToStorage failed for file. Aborting.`);
                URL.revokeObjectURL(fileUrl);
                return;
              }
            }
            
            if (!unmountedRef.current) {
              logger.log(`[${componentId}] File thumbnail success. Calling onSuccess callback.`);
              setHasGeneratedThumbnail(true);
              onSuccess(thumbnailUrl);
            }
          }
          
          URL.revokeObjectURL(fileUrl);
        } catch (e) {
          logger.error(`[${componentId}] Error generating file thumbnail (catch block):`, e);
          URL.revokeObjectURL(fileUrl);
          onFailure?.();
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
            logger.log(`[${componentId}] YouTube thumbnail success. Calling onSuccess callback.`);
            setHasGeneratedThumbnail(true);
            onSuccess(thumbnailUrl);
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
                logger.log(`[${componentId}] URL thumbnail success. Calling onSuccess callback.`);
                setHasGeneratedThumbnail(true);
                // Note: We are not saving URL-based thumbnails currently unless forced?
                // Might need adjustment if saveThumbnail should apply here too.
                onSuccess(dataUrl);
              }
              
              tempVideo.pause();
              tempVideo.src = '';
              tempVideo.load();
            }
          } catch (e) {
            logger.error(`[${componentId}] Error seeking/drawing URL frame (catch block):`, e);
            tempVideo.pause();
            tempVideo.src = '';
            tempVideo.load();
            onFailure?.();
          }
        };
        
        tempVideo.onerror = (e) => {
          logger.error(`[${componentId}] Error loading video for URL thumbnail (onerror):`, e);
          if (!unmountedRef.current) {
            logger.log(`[${componentId}] Calling onFailure callback due to video load error.`);
            onFailure?.();
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
      logger.log(`[${componentId}] Thumbnail generator effect cleanup.`);
      unmountedRef.current = true;
    };
  }, [file, url, onSuccess, saveThumbnail, userId, retryCount, forceGenerate, hasGeneratedThumbnail, onFailure]);

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
