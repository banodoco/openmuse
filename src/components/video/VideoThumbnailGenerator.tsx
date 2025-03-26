
import { useEffect, useRef, useState } from 'react';
import { getYoutubeVideoId } from '@/lib/utils/videoPreviewUtils';

interface VideoThumbnailGeneratorProps {
  file?: File;
  url?: string;
  onThumbnailGenerated: (thumbnailUrl: string) => void;
}

const VideoThumbnailGenerator: React.FC<VideoThumbnailGeneratorProps> = ({
  file,
  url,
  onThumbnailGenerated
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      
      if (videoRef.current) {
        videoRef.current.src = fileUrl;
        videoRef.current.currentTime = 0;
        videoRef.current.muted = true;
        videoRef.current.preload = 'metadata';
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0.1;
          }
        };
        
        videoRef.current.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current?.videoWidth || 640;
            canvas.height = videoRef.current?.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            
            if (ctx && videoRef.current) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              onThumbnailGenerated(dataUrl);
            }
          } catch (e) {
            console.error('Error generating thumbnail:', e);
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
      else if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('vimeo.com') && url.includes('supabase.co')) {
        const tempVideo = document.createElement('video');
        tempVideo.crossOrigin = "anonymous";
        tempVideo.src = url;
        tempVideo.muted = true;
        tempVideo.preload = 'metadata';
        
        tempVideo.onloadedmetadata = () => {
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
              onThumbnailGenerated(dataUrl);
              
              tempVideo.pause();
              tempVideo.src = '';
              tempVideo.load();
            }
          } catch (e) {
            console.error('Error generating thumbnail:', e);
          }
        };
        
        tempVideo.onerror = () => {
          console.error('Error loading video for thumbnail generation');
        };
        
        tempVideo.load();
      }
    }
  }, [file, url, onThumbnailGenerated]);

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
