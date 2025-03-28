
import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useVideoHover } from '@/hooks/useVideoHover';
import { Logger } from '@/lib/logger';
import { attemptVideoPlay } from '@/lib/utils/videoUtils';

const logger = new Logger('VideoPlayer');

interface VideoPlayerProps {
  src: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  poster?: string;
  onError?: (errorMessage: string) => void;
  playOnHover?: boolean;
  containerRef?: React.RefObject<HTMLElement>;
  showPlayButtonOnHover?: boolean;
  isHovering?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  className = '',
  controls = true,
  autoPlay = false,
  loop = true,
  muted = false,
  poster,
  onError,
  playOnHover = false,
  containerRef,
  showPlayButtonOnHover = true,
  isHovering = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [showControls, setShowControls] = useState(false);
  
  // Use external hover state if provided
  const [internalHovering, setInternalHovering] = useState(isHovering);
  
  // Update internal state when external state changes
  useEffect(() => {
    setInternalHovering(isHovering);
    
    // If external hover state is true and play on hover is enabled, play the video
    if (isHovering && playOnHover && videoRef.current) {
      logger.log('VideoPlayer: External hover detected - playing video');
      attemptVideoPlay(videoRef.current, isMuted);
      setIsPlaying(true);
    } else if (!isHovering && playOnHover && videoRef.current && isPlaying) {
      logger.log('VideoPlayer: External hover ended - pausing video');
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isHovering, playOnHover, isMuted]);
  
  // Initialize video on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleVideoLoad = () => {
      logger.log('Video loaded successfully:', src.substring(0, 30) + '...');
      
      // If should play on load, attempt to play
      if (autoPlay && !playOnHover) {
        logger.log('Auto-playing video');
        attemptVideoPlay(video, muted);
      }
      
      // If should initially be hovering, play the video
      if (isHovering && playOnHover) {
        logger.log('VideoPlayer: Initially hovering - playing video immediately');
        attemptVideoPlay(video, muted);
        setIsPlaying(true);
      }
    };
    
    const handleVideoError = (e: ErrorEvent) => {
      const videoElement = e.target as HTMLVideoElement;
      const errorCode = videoElement.error ? videoElement.error.code : 'unknown';
      const errorMessage = videoElement.error ? videoElement.error.message : 'Unknown video error';
      
      logger.error(`Video error (code ${errorCode}): ${errorMessage}`);
      if (onError) {
        onError(`Video error: ${errorMessage}`);
      }
    };
    
    video.addEventListener('loadeddata', handleVideoLoad);
    video.addEventListener('error', handleVideoError as EventListener);
    
    logger.log(`Loading video with source: ${src.substring(0, 50)}...`);
    
    if (autoPlay && !playOnHover) {
      setIsPlaying(true);
    }
    
    return () => {
      video.removeEventListener('loadeddata', handleVideoLoad);
      video.removeEventListener('error', handleVideoError as EventListener);
    };
  }, [src, autoPlay, muted, onError, playOnHover, isHovering]);
  
  // Setup hover play effect
  useVideoHover(
    containerRef || playerRef,
    videoRef,
    {
      enabled: playOnHover && !isHovering, // Disable if external hover state is provided
      resetOnLeave: true
    }
  );
  
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      attemptVideoPlay(video, isMuted);
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };
  
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    const newMutedState = !isMuted;
    video.muted = newMutedState;
    setIsMuted(newMutedState);
  };
  
  return (
    <div 
      ref={playerRef}
      className={`relative overflow-hidden transition-all duration-300 ${className} ${internalHovering ? 'transform scale-105' : ''}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted={isMuted}
        playsInline
        loop={loop}
        className="w-full h-full object-cover"
      />
      
      {(controls && showControls) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 flex justify-between items-center">
          <button 
            onClick={togglePlay}
            className="text-white hover:text-primary transition-colors"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <button
            onClick={toggleMute}
            className="text-white hover:text-primary transition-colors"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      )}
      
      {(showPlayButtonOnHover && showControls && !isPlaying) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button 
            onClick={togglePlay}
            className="bg-black/50 text-white rounded-full p-3 transform transition-transform hover:scale-110"
          >
            <Play size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
