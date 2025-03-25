
import React, { useState, useEffect, useRef } from 'react';
import { FileVideo, Play, AlertCircle, Link as LinkIcon } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { Button } from './ui/button';

interface VideoPreviewProps {
  file?: File;
  url?: string;
  className?: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ file, url, className }) => {
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  // Set isPlaying to true by default for external links
  const [isPlaying, setIsPlaying] = useState(isExternalLink);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Function to extract YouTube video ID
  const getYoutubeVideoId = (youtubeUrl: string): string | null => {
    if (!youtubeUrl) return null;
    
    let videoId = null;
    // Standard YouTube URL
    if (youtubeUrl.includes('youtube.com/watch')) {
      try {
        const urlObj = new URL(youtubeUrl);
        videoId = urlObj.searchParams.get('v');
      } catch (e) {
        console.error('Invalid YouTube URL', e);
      }
    } 
    // Shortened YouTube URL
    else if (youtubeUrl.includes('youtu.be/')) {
      try {
        videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
      } catch (e) {
        console.error('Error parsing shortened YouTube URL', e);
      }
    }
    
    return videoId;
  };
  
  // Create object URL on mount if file is provided
  useEffect(() => {
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setObjectUrl(fileUrl);
      
      // Generate thumbnail/poster for the video
      if (videoRef.current) {
        videoRef.current.src = fileUrl;
        videoRef.current.currentTime = 0;
        videoRef.current.muted = true;
        videoRef.current.preload = 'metadata';
        
        // When metadata is loaded, capture the first frame
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0.1;
          }
        };
        
        // When seeking is complete, capture the frame
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
      
      // Clean up object URL when component unmounts
      return () => {
        if (fileUrl) {
          URL.revokeObjectURL(fileUrl);
        }
      };
    } else if (url) {
      // Set YouTube thumbnail if it's a YouTube URL
      if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const videoId = getYoutubeVideoId(url);
        if (videoId) {
          // Use high-quality YouTube thumbnail
          setPosterUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
        }
      }
      
      setObjectUrl(url);
    }
  }, [file, url]);

  const handlePreviewClick = () => {
    setIsPlaying(true);
  };

  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    setError(null);
    setIsPlaying(true);
  };

  // If neither file nor URL is provided
  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  // Extract YouTube/Vimeo video ID and generate embed URL
  const getEmbedUrl = () => {
    if (!url) return null;
    
    let embedUrl = null;
    
    // YouTube format detection
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      const youtubeId = getYoutubeVideoId(url);
      if (youtubeId) {
        embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
      }
    } 
    // Vimeo format detection 
    else if (url.includes('vimeo.com/')) {
      const vimeoId = url.split('/').pop()?.split('?')[0];
      if (vimeoId) {
        embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
      }
    }
    
    return embedUrl;
  };

  // Create a hidden video element for thumbnail generation
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

  // For external links (YouTube, Vimeo)
  if (isExternalLink) {
    const embedUrl = getEmbedUrl();
    
    return (
      <div className={`relative rounded-md overflow-hidden aspect-video ${className}`}>
        {hiddenVideoElement}
        {isPlaying && embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded video player"
          />
        ) : (
          <div 
            className="w-full h-full flex flex-col items-center justify-center bg-muted/70 cursor-pointer"
            onClick={handlePreviewClick}
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
    <div className={`relative rounded-md overflow-hidden aspect-video ${className}`}>
      {hiddenVideoElement}
      {isPlaying && objectUrl ? (
        <VideoPlayer 
          src={objectUrl} 
          controls={true}
          autoPlay={false}
          className="w-full h-full object-cover"
          onError={(msg) => handleVideoError(msg)}
        />
      ) : (
        <div 
          className="flex flex-col items-center justify-center w-full h-full bg-muted/70 cursor-pointer"
          onClick={handlePreviewClick}
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
