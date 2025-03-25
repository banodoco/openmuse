
import React from 'react';
import { Play, FileVideo } from 'lucide-react';
import { getEmbedUrl } from '@/lib/utils/videoPreviewUtils';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface EmbeddedVideoPlayerProps {
  url: string;
  isPlaying: boolean;
  posterUrl: string | null;
  onTogglePlay: () => void;
  className?: string;
  aspectRatio?: number;
}

const EmbeddedVideoPlayer: React.FC<EmbeddedVideoPlayerProps> = ({
  url,
  isPlaying,
  posterUrl,
  onTogglePlay,
  className = '',
  aspectRatio = 16/9
}) => {
  const embedUrl = getEmbedUrl(url);
  
  return (
    <AspectRatio ratio={aspectRatio} className={`w-full h-full overflow-hidden ${className}`}>
      {isPlaying && embedUrl ? (
        <iframe
          src={`${embedUrl}?autoplay=1&mute=1&controls=0`}
          className="w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Embedded video player"
        />
      ) : (
        <div 
          className="flex flex-col items-center justify-center w-full h-full bg-muted/70 cursor-pointer"
          onClick={onTogglePlay}
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
    </AspectRatio>
  );
};

export default EmbeddedVideoPlayer;
