
import React, { useState, useEffect } from 'react';
import { FileVideo, Play, AlertCircle, Link as LinkIcon } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { Button } from './ui/button';

interface VideoPreviewProps {
  file?: File;
  url?: string;
  className?: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ file, url, className }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));

  // Create object URL on mount if file is provided
  useEffect(() => {
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setObjectUrl(fileUrl);
      
      // Clean up object URL when component unmounts
      return () => {
        if (fileUrl) {
          URL.revokeObjectURL(fileUrl);
        }
      };
    } else if (url) {
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

  // For external links (YouTube, Vimeo)
  if (isExternalLink) {
    return (
      <div className={`relative rounded-md overflow-hidden aspect-video ${className}`}>
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/70">
          <LinkIcon className="h-12 w-12 text-muted-foreground mb-2" />
          <div className="text-center px-4">
            <p className="text-sm font-medium mb-1 break-all">{url}</p>
            <p className="text-xs text-muted-foreground">External video link</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-md overflow-hidden aspect-video ${className}`}>
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
        >
          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="h-6 w-6 text-white" />
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center">
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
