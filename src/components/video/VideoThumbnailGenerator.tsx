
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
  forceCapture?: boolean;
}

const VideoThumbnailGenerator: React.FC<VideoThumbnailGeneratorProps> = ({
  file,
  url,
  onThumbnailGenerated,
  saveThumbnail = false,
  userId,
  forceCapture = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbnailGenerationAttempted, setThumbnailGenerationAttempted] = useState(false);
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const attemptCountRef = useRef(0);
  
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
    // Avoid duplicate thumbnail generation unless forced
    if ((thumbnailGenerationAttempted && !forceCapture) || generationInProgress) {
      return;
    }
    
    if (file) {
      logger.log('Generating thumbnail from file...');
      setThumbnailGenerationAttempted(true);
      setGenerationInProgress(true);
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
              setGenerationInProgress(false);
            }
          } catch (e) {
            logger.error('Error generating thumbnail:', e);
            setGenerationInProgress(false);
          }
        };
      }
      
      return () => {
        URL.revokeObjectURL(fileUrl);
      };
    } 
    else if (url) {
      if (!thumbnailGenerationAttempted || forceCapture) {
        setThumbnailGenerationAttempted(true);
        setGenerationInProgress(true);
        
        if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
          const videoId = getYoutubeVideoId(url);
          if (videoId) {
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            logger.log(`Using YouTube thumbnail: ${thumbnailUrl}`);
            onThumbnailGenerated(thumbnailUrl);
            setGenerationInProgress(false);
          }
        } 
        else if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('vimeo.com')) {
          logger.log('Generating thumbnail from Supabase video URL...');
          // Create a new video element for thumbnail generation
          // This works better cross-platform than using the main video element
          const tempVideo = document.createElement('video');
          tempVideo.crossOrigin = "anonymous";
          tempVideo.src = url;
          tempVideo.muted = true;
          tempVideo.preload = 'metadata';
          
          // Set a timeout to handle cases where the video loading hangs
          const timeoutId = setTimeout(() => {
            logger.warn('Video loading timeout - using fallback placeholder');
            // Fall back to a generic thumbnail or placeholder
            onThumbnailGenerated("/placeholder.svg");
            setGenerationInProgress(false);
            
            // Try again with a different time if this is the first attempt
            if (attemptCountRef.current === 0 && forceCapture) {
              attemptCountRef.current++;
              try {
                tempVideo.currentTime = 1.0; // Try a different timestamp
              } catch (e) {
                logger.error('Error in retry thumbnail generation:', e);
              }
            }
          }, 7000); // Increase timeout to 7 seconds
          
          tempVideo.onloadedmetadata = () => {
            logger.log('Video metadata loaded, seeking to first frame');
            clearTimeout(timeoutId); // Clear the timeout since metadata loaded
            
            // Use a small offset to avoid black frames at the very beginning
            tempVideo.currentTime = 0.1;
          };
          
          tempVideo.onseeked = () => {
            try {
              clearTimeout(timeoutId); // Clear the timeout since we reached this point
              const canvas = document.createElement('canvas');
              canvas.width = tempVideo.videoWidth || 640;
              canvas.height = tempVideo.videoHeight || 360;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                logger.log('Thumbnail generated from video URL');
                onThumbnailGenerated(dataUrl);
                
                // Also save this to storage if requested
                if (saveThumbnail && userId) {
                  saveThumbnailToStorage(dataUrl).then(storedUrl => {
                    if (storedUrl) {
                      // If we successfully saved to storage, use that URL instead
                      onThumbnailGenerated(storedUrl);
                    }
                  });
                }
                
                // Clean up
                tempVideo.pause();
                tempVideo.src = '';
                tempVideo.load();
                setGenerationInProgress(false);
              }
            } catch (e) {
              logger.error('Error generating thumbnail:', e);
              // Fall back to a generic thumbnail or placeholder
              onThumbnailGenerated("/placeholder.svg");
              setGenerationInProgress(false);
            }
          };
          
          tempVideo.onerror = (e) => {
            clearTimeout(timeoutId);
            logger.error('Error loading video for thumbnail generation:', e);
            // Fall back to a generic thumbnail or placeholder
            onThumbnailGenerated("/placeholder.svg");
            setGenerationInProgress(false);
          };
          
          // Explicitly trigger load to start the process
          tempVideo.load();
        } else {
          setGenerationInProgress(false);
        }
      }
    }
  }, [file, url, onThumbnailGenerated, saveThumbnail, userId, thumbnailGenerationAttempted, generationInProgress, forceCapture]);

  return (
    <video 
      ref={videoRef}
      style={{ display: 'none' }}
      muted
      playsInline
      crossOrigin="anonymous"
    >
      {file && <source src={URL.createObjectURL(file)} />}
    </video>
  );
};

export default VideoThumbnailGenerator;
