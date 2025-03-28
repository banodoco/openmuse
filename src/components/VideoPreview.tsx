import React, { useState, useEffect, useRef } from 'react';
import VideoThumbnailGenerator from './video/VideoThumbnailGenerator';
import VideoPreviewError from './video/VideoPreviewError';
import EmbeddedVideoPlayer from './video/EmbeddedVideoPlayer';
import StandardVideoPreview from './video/StandardVideoPreview';
import StorageVideoPlayer from './StorageVideoPlayer';

interface VideoPreviewProps {
  file?: File;
  url?: string;
  className?: string;
  title?: string; // Added title prop for overlay
}

/**
 * VideoPreview component for displaying video previews with thumbnail generation
 * and play on hover functionality.
 */
const VideoPreview: React.FC<VideoPreviewProps> = ({ file, url, className, title }) => {
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const isBlobUrl = url?.startsWith('blob:');
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
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

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className={`absolute inset-0 bg-black transition-opacity duration-300 z-10 pointer-events-none ${isHovering ? 'opacity-0' : 'opacity-40'}`}></div>
      
      {title && (
        <div className={`absolute bottom-0 left-0 right-0 z-20 p-3 transition-opacity duration-300 pointer-events-none ${isHovering ? 'opacity-0' : 'opacity-100'}`}>
          <h3 className="text-white font-semibold text-sm md:text-base truncate shadow-text bg-black/30 px-2 py-1 rounded-sm backdrop-blur-sm">
            {title}
          </h3>
        </div>
      )}
      
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
      ) : file ? (
        // For local file uploads, use standard preview with blob URLs
        <StandardVideoPreview 
          url={objectUrl}
          posterUrl={posterUrl}
          onError={handleVideoError}
        />
      ) : isBlobUrl ? (
        // For blob URLs, use the StorageVideoPlayer with preview mode enabled
        <StorageVideoPlayer
          videoLocation={url}
          controls={false}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={true}
          previewMode={true}
          showPlayButtonOnHover={false}
        />
      ) : url ? (
        // For storage URLs, use the StorageVideoPlayer
        <StorageVideoPlayer
          videoLocation={url}
          controls={true}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={true}
          previewMode={false}
          showPlayButtonOnHover={false}
        />
      ) : null}

      {error && <VideoPreviewError error={error} onRetry={handleRetry} videoSource={objectUrl || undefined} canRecover={false} />}
    </div>
  );
};

export default VideoPreview;
