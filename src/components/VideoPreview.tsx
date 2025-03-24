
import React, { useState, useEffect } from 'react';
import { FileVideo, Play, AlertCircle } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { Button } from './ui/button';

interface VideoPreviewProps {
  file: File;
  className?: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ file, className }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreviewClick = () => {
    if (!objectUrl) {
      setObjectUrl(URL.createObjectURL(file));
    }
    setIsPlaying(true);
  };

  const handleVideoError = (errorMessage: string) => {
    setError(errorMessage);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    setError(null);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    setObjectUrl(URL.createObjectURL(file));
    setIsPlaying(true);
  };

  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  return (
    <div className={`relative rounded-md overflow-hidden aspect-video ${className}`}>
      {isPlaying && objectUrl ? (
        <VideoPlayer 
          src={objectUrl} 
          controls={true}
          autoPlay={true}
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
