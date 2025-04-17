import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Logger } from '@/lib/logger';
import { Play } from 'lucide-react';
import VideoError from './VideoError';
import VideoLoader from './VideoLoader';
import VideoOverlay from './VideoOverlay';
import LazyPosterImage from './LazyPosterImage';
import { useVideoLoader } from '@/hooks/useVideoLoader';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';

const logger = new Logger('VideoPlayer');

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  controls?: boolean;
  onLoadedData?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onError?: (message: string) => void;
  poster?: string;
  playOnHover?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
  showPlayButtonOnHover?: boolean;
  externallyControlled?: boolean;
  isHovering?: boolean;
  lazyLoad?: boolean;
  isMobile?: boolean;
  preventLoadingFlicker?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  autoPlay = false,
  muted = true,
  loop = false,
  className = '',
  controls = true,
  onLoadedData,
  videoRef: externalVideoRef,
  onError,
  poster,
  playOnHover = false,
  containerRef: externalContainerRef,
  showPlayButtonOnHover = true,
  externallyControlled = false,
  isHovering = false,
  lazyLoad = true,
  isMobile = false,
  preventLoadingFlicker = true,
}) => {
  const componentId = useRef(`video_player_${Math.random().toString(36).substring(2, 9)}`).current;
  logger.log(`[${componentId}] Rendering. src: ${src?.substring(0,30)}..., poster: ${!!poster}, lazyLoad: ${lazyLoad}, preventLoadingFlicker: ${preventLoadingFlicker}`);

  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isInternallyHovering, setIsInternallyHovering] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [forcedPlay, setForcedPlay] = useState(false);
  const unmountedRef = useRef(false);
  
  const {
    error,
    isLoading,
    errorDetails,
    handleRetry,
    playAttempted,
    setPlayAttempted
  } = useVideoLoader({
    src,
    poster,
    videoRef,
    onError,
    onLoadedData,
    autoPlay,
    muted,
    playOnHover,
    externallyControlled,
    isHovering: externallyControlled ? isHovering : isInternallyHovering,
    isMobile
  });
  
  useVideoPlayback({
    videoRef,
    externallyControlled,
    isHovering: externallyControlled ? isHovering : isInternallyHovering,
    muted,
    isMobile,
    loadedDataFired: !isLoading,
    playAttempted,
    setPlayAttempted,
    forcedPlay,
    componentId
  });
  
  useEffect(() => {
    logger.log(`[${componentId}] Mounting effect ran.`);
    return () => {
      logger.log(`[${componentId}] Unmounting.`);
      unmountedRef.current = true;
    };
  }, []);
  
  useEffect(() => {
    if (externallyControlled && isHovering && isMobile && !playAttempted && !isLoading && videoRef.current && !unmountedRef.current) {
      logger.log('Forcing play for lightbox on mobile');
      setForcedPlay(true);
      
      const attemptPlay = async () => {
        try {
          if (videoRef.current && !unmountedRef.current) {
            await videoRef.current.play();
            logger.log('Successfully forced play on mobile lightbox');
          }
        } catch (err) {
          logger.error('Failed to force play on mobile lightbox:', err);
        }
      };
      
      attemptPlay();
    }
  }, [externallyControlled, isHovering, isMobile, playAttempted, isLoading, videoRef]);
  
  React.useEffect(() => {
    if (poster) {
      const img = new Image();
      img.onload = () => {
        if (!unmountedRef.current) {
          setPosterLoaded(true);
          logger.log(`[${componentId}] Poster image loaded successfully: ${poster.substring(0, 30)}...`);
        }
      };
      img.onerror = (e) => {
        logger.error(`[${componentId}] Failed to load poster image:`, poster, e);
        if (!unmountedRef.current) {
          setPosterLoaded(false);
        }
      };
      logger.log(`[${componentId}] Starting poster load: ${poster.substring(0, 30)}...`);
      img.src = poster;
    } else {
      logger.log(`[${componentId}] No poster provided.`);
      setPosterLoaded(false); // Ensure posterLoaded is false if no poster
    }
  }, [poster]);
  
  React.useEffect(() => {
    logger.log(`VideoPlayer isMobile state: ${isMobile}`);
    logger.log(`VideoPlayer poster: ${poster ? 'exists' : 'missing'}`);
    logger.log(`VideoPlayer posterLoaded: ${posterLoaded}`);
  }, [isMobile, poster, posterLoaded]);
  
  const loadFullVideo = useCallback(() => {
    if (!hasInteracted && !unmountedRef.current) {
      logger.log('Loading full video on hover');
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  const handleMouseEnter = () => {
    if (!isMobile && !unmountedRef.current) {
      loadFullVideo();
      setIsInternallyHovering(true);
    }
  };

  const handleMouseLeave = () => {
    if (!unmountedRef.current) {
      setIsInternallyHovering(false);
    }
  };

  const handleVideoClick = () => {
    if (isMobile && videoRef.current && !unmountedRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(err => {
          logger.error('Error playing video on click:', err);
        });
      } else {
        videoRef.current.pause();
      }
    }
  };

  const shouldShowLoading = isLoading && (!preventLoadingFlicker || !poster);
  logger.log(`[${componentId}] State: isLoading=${isLoading}, error=${!!error}, hasInteracted=${hasInteracted}, posterLoaded=${posterLoaded}, externallyControlled=${externallyControlled}`);
  logger.log(`[${componentId}] Visibility: shouldShowLoading=${shouldShowLoading}, videoOpacity=${(lazyLoad && poster && !hasInteracted && !externallyControlled) ? 0 : 1}`);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden rounded-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-is-mobile={isMobile ? "true" : "false"}
    >
      {shouldShowLoading && !poster && <VideoLoader posterImage={poster} />}
      
      {error && !onError && (
        <VideoError 
          error={error} 
          errorDetails={errorDetails} 
          onRetry={handleRetry}
          videoSource={src}
        />
      )}
      
      <VideoOverlay 
        isMobile={isMobile && !externallyControlled} 
        poster={poster} 
        posterLoaded={posterLoaded} 
      />
      
      <LazyPosterImage 
        poster={poster} 
        lazyLoad={lazyLoad} 
        hasInteracted={hasInteracted || externallyControlled}
        isMobile={isMobile && !externallyControlled}
      />
      
      <video
        ref={videoRef}
        className={cn("w-full h-full object-cover", className, {
          'opacity-0': (lazyLoad && poster && !hasInteracted && !externallyControlled) 
        })}
        autoPlay={autoPlay && (externallyControlled || (!playOnHover && !isMobile))}
        muted={muted}
        loop={loop}
        controls={isMobile ? true : (showPlayButtonOnHover ? controls : false)}
        playsInline
        poster={poster || undefined}
        preload={(hasInteracted || externallyControlled || preventLoadingFlicker) ? "auto" : "metadata"}
        src={src}
        crossOrigin="anonymous"
        onClick={handleVideoClick}
      >
        Your browser does not support the video tag.
      </video>
      
      {(!isLoading || (isLoading && poster && posterLoaded)) && !error && showPlayButtonOnHover && !isMobile && isInternallyHovering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 opacity-0 hover:opacity-100 pointer-events-none">
          <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
            <Play className="h-8 w-8 text-white" fill="white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
