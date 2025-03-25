
import React, { useState, useEffect, useRef } from 'react';
import { FileVideo } from 'lucide-react';
import VideoThumbnailGenerator from './video/VideoThumbnailGenerator';
import VideoPreviewError from './video/VideoPreviewError';
import EmbeddedVideoPlayer from './video/EmbeddedVideoPlayer';
import StandardVideoPreview from './video/StandardVideoPreview';

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
  aspectRatio
}) => {
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(aspectRatio || 16/9);
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

  // Update aspect ratio if provided via props
  useEffect(() => {
    if (aspectRatio) {
      setVideoAspectRatio(aspectRatio);
    }
  }, [aspectRatio]);

  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    setError(null);
    setIsPlaying(true);
  };

  const handleThumbnailGenerated = (thumbnailUrl: string, width?: number, height?: number) => {
    setPosterUrl(thumbnailUrl);
    
    // If dimensions are provided and no aspect ratio was specified in props,
    // calculate the aspect ratio from the thumbnail
    if (width && height && !aspectRatio) {
      setVideoAspectRatio(width / height);
    }
  };

  if (!file && !url) {
    return (
      <div className={`bg-muted rounded-md aspect-video ${className}`}>
        No video source
      </div>
    );
  }

  return (
    <div 
      ref={previewRef}
      className={`relative ${className}`}
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
        />
      ) : (
        <StandardVideoPreview 
          url={objectUrl}
          posterUrl={posterUrl}
          onError={handleVideoError}
          onLoad={onLoad}
          aspectRatio={videoAspectRatio}
        />
      )}

      {error && <VideoPreviewError error={error} onRetry={handleRetry} />}
    </div>
  );
};

export default VideoPreview;
