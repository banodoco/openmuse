
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@/lib/logger';

const logger = new Logger('VideoThumbnailGenerator');

interface VideoThumbnailGeneratorProps {
  file?: File;
  url?: string;
  onThumbnailGenerated: (thumbnailUrl: string) => void;
  onThumbnailError?: () => void;
  userId?: string;
  saveThumbnail?: boolean;
  forceCapture?: boolean;
  timeout?: number;
  attemptCount?: number;
}

const VideoThumbnailGenerator: React.FC<VideoThumbnailGeneratorProps> = ({
  file,
  url,
  onThumbnailGenerated,
  onThumbnailError,
  userId,
  saveThumbnail = false,
  forceCapture = false,
  timeout = 8000,  // Increased default timeout
  attemptCount = 0
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef<number>(0);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [thumbnailGenerated, setThumbnailGenerated] = useState<boolean>(false);
  const processingRef = useRef<boolean>(false);
  
  // Max attempts to capture frame before falling back
  const MAX_CAPTURE_ATTEMPTS = 3;
  const CAPTURE_POSITIONS = [0.25, 0.5, 0.75, 0.1, 0.9]; // Try these positions in the video

  // Increase timeout for each retry attempt
  const effectiveTimeout = timeout * (1 + (attemptCount * 0.5));

  useEffect(() => {
    // Set up video source
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setVideoSrc(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (url) {
      setVideoSrc(url);
    }
  }, [file, url]);

  useEffect(() => {
    attemptsRef.current = attemptCount;
  }, [attemptCount]);

  useEffect(() => {
    let mounted = true;
    let videoElement = videoRef.current;
    
    // Set up timeout to handle video loading failures
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (mounted && !videoLoaded) {
        logger.warn(`Video loading timeout - using fallback placeholder`);
        if (onThumbnailError) {
          onThumbnailError();
        }
        onThumbnailGenerated('/placeholder.svg');
      }
    }, effectiveTimeout);

    // Clean up function
    return () => {
      mounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Clean up event listeners
      if (videoElement) {
        videoElement.onloadedmetadata = null;
        videoElement.onloadeddata = null;
        videoElement.onerror = null;
      }
    };
  }, [effectiveTimeout, onThumbnailGenerated, onThumbnailError, videoLoaded]);

  const captureFrame = (attemptIndex: number = 0) => {
    if (processingRef.current) {
      logger.log('Frame capture already in progress, skipping');
      return;
    }
    
    if (videoRef.current && canvasRef.current) {
      processingRef.current = true;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      try {
        // Try different positions in the video based on attempt number
        const positions = CAPTURE_POSITIONS;
        const position = positions[attemptIndex % positions.length];
        
        // Calculate target time in the video
        const targetTime = position * videoDuration;
        
        // Set the current time and wait for seeked event
        video.currentTime = targetTime;
        
        video.onseeked = () => {
          try {
            const context = canvas.getContext('2d');
            if (context) {
              // Set canvas dimensions to match video
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              
              // Draw the video frame to the canvas
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Convert canvas to Blob
              canvas.toBlob(async (blob) => {
                if (blob) {
                  // If we should save the thumbnail to storage
                  if (saveThumbnail && userId) {
                    try {
                      const thumbnailId = uuidv4();
                      const filePath = `thumbnails/${userId}/${thumbnailId}.jpg`;
                      
                      const { data, error } = await supabase.storage
                        .from('media')
                        .upload(filePath, blob, {
                          contentType: 'image/jpeg',
                          cacheControl: '3600',
                          upsert: true,
                        });
                        
                      if (error) {
                        logger.error('Error uploading thumbnail:', error);
                        // Generate a local object URL as fallback
                        const objUrl = URL.createObjectURL(blob);
                        onThumbnailGenerated(objUrl);
                      } else {
                        // Get public URL for the uploaded thumbnail
                        const { data: publicUrlData } = await supabase.storage
                          .from('media')
                          .getPublicUrl(filePath);
                        
                        if (publicUrlData && publicUrlData.publicUrl) {
                          onThumbnailGenerated(publicUrlData.publicUrl);
                        } else {
                          // Fallback to object URL
                          const objUrl = URL.createObjectURL(blob);
                          onThumbnailGenerated(objUrl);
                        }
                      }
                    } catch (err) {
                      logger.error('Error in thumbnail upload process:', err);
                      // Fallback to object URL
                      const objUrl = URL.createObjectURL(blob);
                      onThumbnailGenerated(objUrl);
                    }
                  } else {
                    // Just create a local object URL
                    const objUrl = URL.createObjectURL(blob);
                    onThumbnailGenerated(objUrl);
                  }
                  
                  setThumbnailGenerated(true);
                  processingRef.current = false;
                } else {
                  logger.error('Failed to create blob from canvas');
                  handleCaptureFailed(attemptIndex + 1);
                }
              }, 'image/jpeg', 0.85);
            } else {
              logger.error('Could not get canvas context');
              handleCaptureFailed(attemptIndex + 1);
            }
          } catch (err) {
            logger.error('Error during frame capture:', err);
            handleCaptureFailed(attemptIndex + 1);
          }
        };
        
        // Handle seek errors
        video.onseekingerror = () => {
          logger.error(`Error seeking to position ${position}`);
          handleCaptureFailed(attemptIndex + 1);
        };
      } catch (err) {
        logger.error('Error in capture frame process:', err);
        handleCaptureFailed(attemptIndex + 1);
      }
    } else {
      logger.error('Video or canvas ref not available');
      if (onThumbnailError) {
        onThumbnailError();
      }
      onThumbnailGenerated('/placeholder.svg');
      processingRef.current = false;
    }
  };
  
  const handleCaptureFailed = (nextAttempt: number) => {
    processingRef.current = false;
    
    if (nextAttempt < MAX_CAPTURE_ATTEMPTS) {
      logger.warn(`Capture attempt ${nextAttempt} failed, trying again`);
      setTimeout(() => captureFrame(nextAttempt), 200); // Slight delay before next attempt
    } else {
      logger.error(`Failed to capture frame after ${MAX_CAPTURE_ATTEMPTS} attempts`);
      if (onThumbnailError) {
        onThumbnailError();
      }
      onThumbnailGenerated('/placeholder.svg');
    }
  };

  return (
    <div className="hidden">
      <video
        ref={videoRef}
        src={videoSrc}
        crossOrigin="anonymous"
        preload="auto"
        playsInline
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          setVideoDuration(video.duration);
          
          // For short videos, start capturing early
          if (video.duration < 5 && forceCapture) {
            setVideoLoaded(true);
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            captureFrame(attemptsRef.current);
          }
        }}
        onLoadedData={(e) => {
          setVideoLoaded(true);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          // Only capture if we haven't already
          if (!thumbnailGenerated && !processingRef.current) {
            captureFrame(attemptsRef.current);
          }
        }}
        onError={(e) => {
          const target = e.currentTarget;
          logger.error(`Video load error: ${target.error?.message || 'unknown error'}`);
          
          if (onThumbnailError) {
            onThumbnailError();
          }
          
          // Fallback to placeholder
          onThumbnailGenerated('/placeholder.svg');
        }}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default VideoThumbnailGenerator;
