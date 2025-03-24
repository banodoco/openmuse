
import React, { useState } from 'react';
import { FileVideo, Play } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

interface VideoPreviewProps {
  file: File;
  className?: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ file, className }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const handlePreviewClick = () => {
    if (!objectUrl) {
      setObjectUrl(URL.createObjectURL(file));
    }
    setIsPlaying(true);
  };

  // Clean up object URL when component unmounts
  React.useEffect(() => {
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
    </div>
  );
};

export default VideoPreview;
