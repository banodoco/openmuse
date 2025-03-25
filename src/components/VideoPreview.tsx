
import React, { useState, useEffect, useRef } from 'react';
import { FileVideo } from 'lucide-react';
import VideoThumbnailGenerator from './video/VideoThumbnailGenerator';
import VideoPreviewError from './video/VideoPreviewError';
import EmbeddedVideoPlayer from './video/EmbeddedVideoPlayer';
import StandardVideoPreview from './video/StandardVideoPreview';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface VideoPreviewProps {
  file?: File;
  url?: string;
  className?: string;
  onLoad?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  aspectRatio?: number;
}

/**
 * VideoPreview component for displaying video previews with thumbnail generation
 * and play on hover functionality.
 */
const VideoPreview: React.FC<VideoPreviewProps> = ({ 
  file, 
  url, 
  className, 
  onLoad,
  aspectRatio = 16/9
}) => {
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(aspectRatio);
  const previewRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Set up object URL for file preview
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setObjectUrl(fileUrl);
      
      return () => {
        if (fileUrl) {
          URL.revokeObjectURL(fileUrl);
        }
      };
    } else if (url && !isExternalLink) {
      setObjectUrl(url);
    }
  }, [file, url, isExternalLink]);

  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    setError(null);
    setIsPlaying(true);
  };

  const handleThumbnailGenerated = (thumbnailUrl: string) => {
    setPosterUrl(thumbnailUrl);
  };

  const handleVideoLoaded = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (video.videoWidth && video.videoHeight) {
      const ratio = video.videoWidth / video.videoHeight;
      // Only update if significantly different to avoid flickering
      if (Math.abs(ratio - videoAspectRatio) > 0.1) {
        setVideoAspectRatio(ratio);
      }
    }
    
    if (onLoad) {
      onLoad(event);
    }
  };

  if (!file && !url) {
    return (
      <AspectRatio ratio={aspectRatio} className={`bg-muted rounded-md ${className}`}>
        <div className="flex items-center justify-center w-full h-full">
          <span>No video source</span>
        </div>
      </AspectRatio>
    );
  }

  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden ${className}`}
      onMouseEnter={() => setIsPlaying(true)}
      onMouseLeave={() => setIsPlaying(false)}
    >
      <VideoThumbnailGenerator 
        file={file}
        url={url}
        onThumbnailGenerated={handleThumbnailGenerated}
      />
      
      {isExternalLink ? (
        <EmbeddedVideoPlayer 
          url={url || ''}
          isPlaying={isPlaying}
          posterUrl={posterUrl}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          aspectRatio={videoAspectRatio}
        />
      ) : (
        <StandardVideoPreview 
          url={objectUrl}
          posterUrl={posterUrl}
          onError={handleVideoError}
          onLoad={handleVideoLoaded}
          aspectRatio={videoAspectRatio}
        />
      )}

      {error && <VideoPreviewError error={error} onRetry={handleRetry} />}
    </div>
  );
};

export default VideoPreview;
