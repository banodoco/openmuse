
import React from 'react';
import { Play, FileVideo } from 'lucide-react';
import { getEmbedUrl } from '@/lib/utils/videoPreviewUtils';
import { useIsMobile } from '@/hooks/use-mobile';

interface EmbeddedVideoPlayerProps {
  url: string;
  isPlaying: boolean;
  posterUrl: string | null;
  onTogglePlay: () => void;
  className?: string;
  showPlayButtonOnMobile?: boolean;
}

const EmbeddedVideoPlayer: React.FC<EmbeddedVideoPlayerProps> = ({
  url,
  isPlaying,
  posterUrl,
  onTogglePlay,
  className = '',
  showPlayButtonOnMobile = true
}) => {
  const isMobile = useIsMobile();
  const embedUrl = getEmbedUrl(url);
  
  if (isPlaying && embedUrl) {
    return (
      <iframe
        src={`${embedUrl}?autoplay=1&mute=1&controls=0`}
        className={`w-full h-full ${className}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Embedded video player"
      />
    );
  }
  
  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center bg-muted/70 cursor-pointer"
      onClick={onTogglePlay}
      style={posterUrl ? {
        backgroundImage: `url(${posterUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : {}}
    >
      {(!isMobile || showPlayButtonOnMobile) && (
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
          <Play className="h-6 w-6 text-white" />
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground flex items-center bg-black/50 px-2 py-1 rounded">
        <FileVideo className="h-3 w-3 mr-1" />
        Preview
      </div>
    </div>
  );
};

export default EmbeddedVideoPlayer;
