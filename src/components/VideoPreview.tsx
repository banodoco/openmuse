
import React, { useState, useEffect, useRef } from 'react';
import { FileVideo, Play, AlertCircle } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { Button } from './ui/button';

interface VideoPreviewProps {
  file?: File;
  url?: string;
  className?: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ file, url, className }) => {
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const getYoutubeVideoId = (youtubeUrl: string): string | null => {
    if (!youtubeUrl) return null;
    
    let videoId = null;
    if (youtubeUrl.includes('youtube.com/watch')) {
      try {
        const urlObj = new URL(youtubeUrl);
        videoId = urlObj.searchParams.get('v');
      } catch (e) {
        console.error('Invalid YouTube URL', e);
      }
    } 
    else if (youtubeUrl.includes('youtu.be/')) {
      try {
        videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
      } catch (e) {
        console.error('Error parsing shortened YouTube URL', e);
      }
    }
    
    return videoId;
  };
  
  useEffect(() => {
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setObjectUrl(fileUrl);
      
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
              setPosterUrl(dataUrl);
            }
          } catch (e) {
            console.error('Error generating thumbnail:', e);
          }
        };
      }
      
      return () => {
        if (fileUrl) {
          URL.revokeObjectURL(fileUrl);
        }
      };
    } else if (url) {
      if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const videoId = getYoutubeVideoId(url);
        if (videoId) {
          setPosterUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
        }
      } else if (!isExternalLink && url.includes('supabase.co')) {
        setObjectUrl(url);
        
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
              setPosterUrl(dataUrl);
              
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
          setPosterUrl(null);
        };
        
        tempVideo.load();
      } else {
        setObjectUrl(url);
      }
    }
    
    return () => {
      if (file) {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      }
    };
  }, [file, url, isExternalLink]);

  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    setError(null);
    setIsPlaying(true);
  };

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  const getEmbedUrl = () => {
    if (!url) return null;
    
    let embedUrl = null;
    
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      const youtubeId = getYoutubeVideoId(url);
      if (youtubeId) {
        embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
      }
    } 
    else if (url.includes('vimeo.com/')) {
      const vimeoId = url.split('/').pop()?.split('?')[0];
      if (vimeoId) {
        embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
      }
    }
    
    return embedUrl;
  };

  const hiddenVideoElement = (
    <video 
      ref={videoRef}
      style={{ display: 'none' }}
      muted
      playsInline
    >
      {file && <source src={URL.createObjectURL(file)} />}
    </video>
  );

  if (isExternalLink) {
    const embedUrl = getEmbedUrl();
    
    return (
      <div 
        ref={previewRef}
        className={`relative rounded-md overflow-hidden aspect-video ${className}`}
        onMouseEnter={() => setIsPlaying(true)}
        onMouseLeave={() => setIsPlaying(false)}
      >
        {hiddenVideoElement}
        {isPlaying && embedUrl ? (
          <iframe
            src={`${embedUrl}?autoplay=1&mute=1&controls=0`}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded video player"
          />
        ) : (
          <div 
            className="w-full h-full flex flex-col items-center justify-center bg-muted/70 cursor-pointer"
            onClick={() => setIsPlaying(true)}
            style={posterUrl ? {
              backgroundImage: `url(${posterUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : {}}
          >
            <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
              <Play className="h-6 w-6 text-white" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground flex items-center bg-black/50 px-2 py-1 rounded">
              <FileVideo className="h-3 w-3 mr-1" />
              Preview
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
    >
      {hiddenVideoElement}
      {objectUrl ? (
        <VideoPlayer 
          src={objectUrl} 
          controls={false}
          autoPlay={false}
          muted={true}
          className="w-full h-full object-cover"
          onError={(msg) => handleVideoError(msg)}
          poster={posterUrl || undefined}
          playOnHover={true}
        />
      ) : (
        <div 
          className="flex flex-col items-center justify-center w-full h-full bg-muted/70 cursor-pointer"
          style={posterUrl ? {
            backgroundImage: `url(${posterUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          } : {}}
        >
          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="h-6 w-6 text-white" />
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center bg-black/50 px-2 py-1 rounded">
            <FileVideo className="h-3 w-3 mr-1" />
            Preview
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-background p-4 rounded-lg max-w-[90%] text-center">
            <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
            <h4 className="font-medium text-sm mb-1">Error loading video</h4>
            <p className="text-xs text-muted-foreground mb-3">{error}</p>
            <Button size="sm" onClick={handleRetry}>Try again</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;
