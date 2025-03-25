
import React from 'react';
import { Play, FileVideo } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface StandardVideoPreviewProps {
  url: string | null;
  posterUrl: string | null;
  onError: (msg: string) => void;
  onLoad?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  aspectRatio?: number;
}

const StandardVideoPreview: React.FC<StandardVideoPreviewProps> = ({
  url,
  posterUrl,
  onError,
  onLoad,
  aspectRatio = 16/9
}) => {
  if (!url) {
    return (
      <AspectRatio ratio={aspectRatio} className="bg-muted/30 overflow-hidden rounded-md">
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
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={aspectRatio} className="overflow-hidden rounded-md">
      <VideoPlayer 
        src={url} 
        controls={false}
        autoPlay={false}
        muted={true}
        className="w-full h-full object-cover"
        onError={onError}
        poster={posterUrl || undefined}
        playOnHover={true}
        onLoadedData={onLoad}
      />
    </AspectRatio>
  );
};

export default StandardVideoPreview;
