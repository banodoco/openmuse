
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
  title?: string;
  creator?: string;
}

/**
 * VideoPreview component for displaying video previews with thumbnail generation
 * and play on hover functionality.
 */
const VideoPreview: React.FC<VideoPreviewProps> = ({ 
  file, 
  url, 
  className,
  title,
  creator 
}) => {
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
    setIsPlaying(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsPlaying(false);
  };

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
          playOnHover={true}  // Always enable playOnHover for blob URLs
          previewMode={true}
          showPlayButtonOnHover={false}
          autoPlay={isHovering} // Use isHovering to control autoPlay
        />
      ) : url ? (
        // For storage URLs, use the StorageVideoPlayer
        <StorageVideoPlayer
          videoLocation={url}
          controls={false}
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={true}  // Always enable playOnHover
          previewMode={false}
          showPlayButtonOnHover={false}
          autoPlay={isHovering} // Use isHovering to control autoPlay
        />
      ) : null}

      {error && <VideoPreviewError error={error} onRetry={handleRetry} videoSource={objectUrl || undefined} canRecover={false} />}
      
      {/* Title overlay in top left corner */}
      {title && (
        <div className={`absolute top-2 left-2 z-20 px-3 py-1.5 bg-white bg-opacity-70 rounded transition-opacity duration-300 ${isHovering ? 'opacity-30' : 'opacity-90'}`}>
          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{title}</p>
        </div>
      )}
      
      {/* Creator overlay in bottom right corner */}
      {creator && (
        <div className={`absolute bottom-2 right-2 z-20 px-3 py-1.5 bg-white bg-opacity-70 rounded transition-opacity duration-300 ${isHovering ? 'opacity-30' : 'opacity-90'}`}>
          <p className="text-xs text-gray-800">{creator}</p>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;
