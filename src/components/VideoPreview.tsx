
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
}

/**
 * VideoPreview component for displaying video previews with thumbnail generation
 * and play on hover functionality.
 */
const VideoPreview: React.FC<VideoPreviewProps> = ({ file, url, className }) => {
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
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

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
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
        />
      )}

      {error && <VideoPreviewError error={error} onRetry={handleRetry} />}
    </div>
  );
};

export default VideoPreview;
