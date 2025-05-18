import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import VideoPlayer from './video/VideoPlayer';
import { Logger } from '@/lib/logger';
import VideoPreviewError from './video/VideoPreviewError';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const logger = new Logger('StorageVideoPlayer');

// --- BEGIN NEW PlayerStatus TYPE ---
type PlayerStatus =
  | 'idle'          // Initial state, or after src change before any loading
  | 'url-loading'   // videoUrlService.getVideoUrl is in progress
  | 'media-loading' // VideoPlayer has src, hls.js/browser is loading media
  | 'ready'         // Media is loaded enough to play (onCanPlay)
  | 'playing'
  | 'paused'
  | 'error';
// --- END NEW PlayerStatus TYPE ---

interface StorageVideoPlayerProps {
  videoLocation: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playOnHover?: boolean;
  previewMode?: boolean;
  showPlayButtonOnHover?: boolean;
  isHoveringExternally?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onLoadedData?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  thumbnailUrl?: string;
  forcePreload?: boolean;
  isMobile?: boolean;
  preventLoadingFlicker?: boolean;
  allowControlInteraction?: boolean;
  onVisibilityChange?: (isVisible: boolean) => void;
  shouldBePlaying?: boolean;
  onEnterPreloadArea?: (isInPreloadArea: boolean) => void;
  onError?: (message: string) => void;
}

const StorageVideoPlayer: React.FC<StorageVideoPlayerProps> = memo(({
  videoLocation,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  playOnHover = false,
  previewMode = false,
  showPlayButtonOnHover = true,
  isHoveringExternally,
  videoRef: externalVideoRef,
  onLoadedData,
  thumbnailUrl,
  forcePreload = false,
  isMobile = false,
  preventLoadingFlicker = true,
  allowControlInteraction = false,
  onVisibilityChange,
  shouldBePlaying = false,
  onEnterPreloadArea,
  onError,
}) => {
  const componentId = useRef(`storage_video_${Math.random().toString(36).substring(2, 9)}`).current;
  const logPrefix = `[SVP_DEBUG][${componentId}]`;

  // DEBUG LOGGING: Track key props on mobile
  useEffect(() => {
    if (isMobile) {
      logger.log(`${logPrefix} Mobile props update: isMobile=${isMobile}, autoPlay=${autoPlay}, isHoveringExternally=${isHoveringExternally}, shouldBePlaying=${shouldBePlaying}`);
    }
  }, [isMobile, autoPlay, isHoveringExternally, shouldBePlaying]);
  // END DEBUG LOGGING

  // logger.log(`${logPrefix} Rendering. Initial props: thumbnailUrl=${!!thumbnailUrl}, forcePreload=${forcePreload}, autoPlay=${autoPlay}, shouldBePlaying=${shouldBePlaying}`);

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isHovering, setIsHovering] = useState(isHoveringExternally || false);
  const [hasHovered, setHasHovered] = useState(forcePreload || (!isMobile && autoPlay));
  const [internalTriggerPlay, setInternalTriggerPlay] = useState(false); 
  const prevVideoLocationRef = useRef<string | null>(null);
  const [preloadTriggered, setPreloadTriggered] = useState(false);

  // --- NEW playerStatus STATE ---
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');

  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const isHoveringRef = useRef(isHoveringExternally || false); // Ref to track hover state
  const unmountedRef = useRef(false);
  
  const isBlobUrl = videoLocation.startsWith('blob:');

  // Cleanup on unmount
  useEffect(() => {
    // logger.log(`${logPrefix} Mounting effect ran.`);
    return () => {
      // logger.log(`${logPrefix} Unmounting.`);
      unmountedRef.current = true;
    };
  }, []);

  // --- REFACTORED INITIAL LOAD AND VIDEO LOCATION CHANGE LOGIC ---
  useEffect(() => {
    if (unmountedRef.current) return;

    if (prevVideoLocationRef.current !== videoLocation) {
      logger.log(`${logPrefix} New videoLocation. Resetting. Old: ${prevVideoLocationRef.current}, New: ${videoLocation}`);
      setVideoUrl('');
      setError(null);
      setErrorDetails(null);
      setPlayerStatus('idle');
      setInternalTriggerPlay(false);
      // Note: retryCount is not reset here, it's part of the retry mechanism itself.
      // hasHovered and preloadTriggered persist unless specifically reset by other logic.
    }
    prevVideoLocationRef.current = videoLocation;

    const shouldInitiateLoad = forcePreload || (isMobile && autoPlay) || shouldBePlaying;
    
    if (videoLocation && playerStatus === 'idle' && shouldInitiateLoad) {
      logger.log(`${logPrefix} Conditions met for initial URL load. Setting status to url-loading.`);
      setPlayerStatus('url-loading');
    } else if (!videoLocation && playerStatus !== 'idle') {
      logger.log(`${logPrefix} videoLocation is empty. Resetting to idle.`);
      setPlayerStatus('idle');
      setVideoUrl('');
      setError(null);
    }
  }, [videoLocation, forcePreload, isMobile, autoPlay, shouldBePlaying]); // playerStatus removed, it caused loop

  // Effect to fetch the video URL when status is 'url-loading'
  useEffect(() => {
    let isMounted = true;
    if (unmountedRef.current || playerStatus !== 'url-loading') return;

    const loadVideoUrl = async () => {
      if (!videoLocation) {
        logger.warn(`${logPrefix} loadVideoUrl called without videoLocation.`);
        if (isMounted && !unmountedRef.current) setPlayerStatus('error');
        return;
      }
      logger.log(`${logPrefix} [${playerStatus}] Attempting to load video URL for: ${videoLocation.substring(0, 50)}...`);
      
      try {
        const fetchedUrl = isBlobUrl ? videoLocation : await videoUrlService.getVideoUrl(videoLocation, previewMode);
        if (!fetchedUrl) throw new Error('Could not resolve video URL');
        
        if (isMounted && !unmountedRef.current) {
          logger.log(`${logPrefix} Fetched URL. Setting videoUrl, status to media-loading.`);
          setVideoUrl(fetchedUrl);
          setPlayerStatus('media-loading'); 
          setError(null);
        }
      } catch (err) {
        logger.error(`${logPrefix} Error in loadVideoUrl for ${videoLocation}:`, err);
        if (isMounted && !unmountedRef.current) {
          setError(`Failed to load video URL: ${err instanceof Error ? err.message : String(err)}`);
          setErrorDetails(String(err));
          setPlayerStatus('error');
        }
      }
    };
    
    loadVideoUrl();
    
    return () => { isMounted = false; };
  }, [playerStatus, videoLocation, previewMode, isBlobUrl, retryCount]);
  // --- END REFACTORED URL LOADING LOGIC ---

  // Effect to sync external hover state 
  useEffect(() => {
    isHoveringRef.current = isHoveringExternally || false;
    if (isHoveringExternally !== undefined && !unmountedRef.current) {
      setIsHovering(isHoveringExternally);
      // Play/load logic on hover will be handled by other effects reacting to playerStatus and isHovering
    }
  }, [isHoveringExternally]);

  // --- REFINED PLAY/PAUSE INTENT LOGIC ---
  useEffect(() => {
    if (unmountedRef.current) return;

    let playIntent = false;
    if (isMobile && autoPlay) {
      playIntent = true;
      if (playerStatus === 'idle') setPlayerStatus('url-loading');
    } else if (shouldBePlaying) {
      playIntent = true;
      if (playerStatus === 'idle') setPlayerStatus('url-loading');
    } else if (playOnHover && isHovering && !isMobile) {
      playIntent = true;
      if (playerStatus === 'idle' && videoLocation) setPlayerStatus('url-loading');
    }

    // Actual play/pause based on playerStatus and videoRef
    if (playIntent) {
      if ((playerStatus === 'ready' || playerStatus === 'paused') && videoRef.current?.paused) {
        logger.log(`${logPrefix} Play intent TRUE, status=${playerStatus}. Attempting play.`);
        videoRef.current.play().catch(err => logger.warn(`${logPrefix} Play attempt failed:`, err));
      }
    } else {
      if (playerStatus === 'playing' && videoRef.current && !videoRef.current.paused) {
        logger.log(`${logPrefix} Play intent FALSE, status=${playerStatus}. Attempting pause.`);
        videoRef.current.pause();
      }
    }
    // internalTriggerPlay is NOT directly set here anymore for VideoPlayer prop.
    // VideoPlayer's autoPlay prop will be false. This effect manages direct play/pause.

  }, [isHovering, playerStatus, isMobile, playOnHover, autoPlay, shouldBePlaying, videoRef, videoLocation]);

  useEffect(() => {
    if (isMobile && forcePreload && !unmountedRef.current && playerStatus === 'idle') {
      logger.log(`${logPrefix} Mobile + forcePreload: Setting status to url-loading.`);
      setPlayerStatus('url-loading');
      setHasHovered(true);
    }
  }, [isMobile, forcePreload, playerStatus]);

  const handleManualHoverStart = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      setIsHovering(true);
      setHasHovered(true);
      if (playerStatus === 'idle' && videoLocation) {
        logger.log(`${logPrefix} Manual hover start, was idle. Setting to url-loading.`);
        setPlayerStatus('url-loading');
      }
    }
  };

  const handleManualHoverEnd = () => {
    if (isHoveringExternally === undefined && !unmountedRef.current) {
      setIsHovering(false);
    }
  };
  
  const handleEnterPreloadArea = useCallback((isInPreloadArea: boolean) => {
    if (unmountedRef.current) return;
    if (onEnterPreloadArea) onEnterPreloadArea(isInPreloadArea);

    if (isInPreloadArea && !preloadTriggered) {
      logger.log(`${logPrefix} Entered preload area. Current status: ${playerStatus}`);
      setPreloadTriggered(true);
      if (playerStatus === 'idle' && videoLocation) {
        logger.log(`${logPrefix} Preload area: Triggering URL load.`);
        setPlayerStatus('url-loading');
      }
    }
  }, [preloadTriggered, playerStatus, videoLocation, onEnterPreloadArea, logPrefix]);

  const handleVideoErrorProp = (message: string) => {
    if (!unmountedRef.current) {
      logger.error(`${logPrefix} VideoPlayer reported error: ${message}. Setting status to error.`);
      setError(message);
      setPlayerStatus('error'); 
      if (onError) onError(message);
    }
  };

  const handleRetry = () => {
    if (!unmountedRef.current) {
      logger.log(`${logPrefix} Retrying video...`);
      setError(null);
      setErrorDetails(null);
      setVideoUrl(''); 
      setPlayerStatus('idle');
      setRetryCount(prev => prev + 1);
      prevVideoLocationRef.current = null; 
    }
  };
  
  const handleVideoLoadedDataInternal = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!unmountedRef.current) {
      logger.log(`${logPrefix} VideoPlayer onLoadedData. Status: ${playerStatus}`);
      if (onLoadedData) onLoadedData(event);
    }
  };

  const handleMobileTap = () => {
    if (isMobile && !unmountedRef.current) {
      logger.log(`${logPrefix} Mobile tap. Status: ${playerStatus}`);
      setHasHovered(true); 
      if (playerStatus === 'idle' && videoLocation) {
        setPlayerStatus('url-loading');
      } else if ((playerStatus === 'ready' || playerStatus === 'paused') && videoRef.current?.paused) {
        videoRef.current.play().catch(err => logger.warn(`${logPrefix} Mobile tap play failed:`, err));
      }
    }
  };

  const showVideo = !!videoUrl && playerStatus !== 'idle' && playerStatus !== 'url-loading' && playerStatus !== 'error';
  const showLoadingSpinner = (playerStatus === 'url-loading' || playerStatus === 'media-loading') && !error;
  const showThumbnail = !!thumbnailUrl && !error && 
                      (playerStatus === 'idle' || 
                       playerStatus === 'url-loading' || 
                       (playerStatus === 'media-loading' && preventLoadingFlicker) || 
                       ((playerStatus === 'ready' || playerStatus === 'paused') && preventLoadingFlicker && !(playOnHover && isHovering)));

  // --- VideoPlayer Event Handlers for playerStatus ---
  const handlePlayerLoadStart = useCallback(() => {
    if (unmountedRef.current || playerStatus === 'media-loading') return;
    logger.log(`${logPrefix} VideoPlayer onLoadStart. Setting status to media-loading.`);
    setPlayerStatus('media-loading');
  }, [logPrefix, playerStatus]);

  const handlePlayerCanPlay = useCallback(() => {
    if (unmountedRef.current || playerStatus === 'ready' || playerStatus === 'playing' || playerStatus === 'paused') return;
    logger.log(`${logPrefix} VideoPlayer onCanPlay. Setting status to ready.`);
    setPlayerStatus('ready');
  }, [logPrefix, playerStatus]);

  const handlePlayerPlay = useCallback(() => {
    if (unmountedRef.current || playerStatus === 'playing') return;
    logger.log(`${logPrefix} VideoPlayer onPlay. Setting status to playing.`);
    setPlayerStatus('playing');
  }, [logPrefix, playerStatus]);

  const handlePlayerPause = useCallback(() => {
    if (unmountedRef.current || playerStatus === 'paused' || playerStatus === 'idle' || playerStatus === 'error') return;
    logger.log(`${logPrefix} VideoPlayer onPause. Setting status to paused.`);
    setPlayerStatus('paused');
  }, [logPrefix, playerStatus]);

  return (
    <div 
      className={cn(
        "relative w-full h-full bg-muted overflow-hidden",
        className
      )}
      ref={containerRef}
      data-is-mobile={isMobile ? "true" : "false"}
      data-is-hovering={isHovering ? "true" : "false"}
      data-player-status={playerStatus} // For debugging
      onClick={isMobile ? handleMobileTap : undefined}
      onMouseEnter={!isMobile && playOnHover ? handleManualHoverStart : undefined}
      onMouseLeave={!isMobile && playOnHover ? handleManualHoverEnd : undefined}
    >
      <div className="relative w-full h-full">
        {error && (
          <div className="absolute inset-0 z-30">
            <VideoPreviewError 
              error={error} 
              details={errorDetails || undefined}
              onRetry={handleRetry} 
              videoSource={videoUrl || videoLocation}
              canRecover={!previewMode}
            />
          </div>
        )}
        {showThumbnail && (
           <img 
             src={thumbnailUrl} 
             alt="Video thumbnail" 
             className={cn(
               "absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10 pointer-events-none",
               (playerStatus !== 'idle' && playerStatus !== 'url-loading' && playerStatus !== 'media-loading') ? "opacity-0" : "opacity-100"
             )}
             loading="lazy"
             onLoad={() => logger.log(`${logPrefix} Thumbnail img loaded: ${thumbnailUrl?.substring(0,30)}...`)}
             onError={() => logger.error(`${logPrefix} Thumbnail img failed to load: ${thumbnailUrl?.substring(0,30)}...`)}
           />
         )}
        {showLoadingSpinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
          </div>
        )}
        {showVideo && (
          <VideoPlayer
            key={`${componentId}-${videoUrl}`}
            src={videoUrl}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              (playerStatus === 'ready' || playerStatus === 'playing' || playerStatus === 'paused') ? "opacity-100" : "opacity-0"
            )}
            controls={controls && !previewMode}
            autoPlay={false} // Let StorageVideoPlayer manage play/pause via ref
            playsInline
            muted={muted}
            loop={loop} // Loop can be declarative as it doesn't affect stalling often
            playOnHover={false} // SVP handles hover logic
            onError={handleVideoErrorProp}
            showPlayButtonOnHover={showPlayButtonOnHover && !isMobile}
            containerRef={containerRef} 
            ref={videoRef} // Crucial for direct play/pause control
            externallyControlled={isHoveringExternally !== undefined} 
            isHovering={isHovering} // Pass down for VideoPlayer's internal logic if any (though we disabled playOnHover)
            poster={undefined} // Poster handled by SVP's img tag
            showFirstFrameAsPoster={false} // SVP handles thumbnail/poster logic
            lazyLoad={!forcePreload} 
            preventLoadingFlicker={preventLoadingFlicker}
            onLoadedData={handleVideoLoadedDataInternal} 
            onLoadStart={handlePlayerLoadStart} 
            isMobile={isMobile}
            preload="auto" 
            onVisibilityChange={onVisibilityChange}
            onEnterPreloadArea={handleEnterPreloadArea}
            onCanPlay={handlePlayerCanPlay} 
            onPlay={handlePlayerPlay} 
            onPause={handlePlayerPause} 
          />
        )}
         {thumbnailUrl && !isHovering && showPlayButtonOnHover && !isMobile && !error && playerStatus !== 'playing' && playerStatus !== 'media-loading' && playerStatus !== 'url-loading' && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/10">
             <div className="rounded-full bg-black/40 p-3 backdrop-blur-sm">
               <Play className="h-6 w-6 text-white" fill="white" />
             </div>
           </div>
         )}
      </div>
    </div>
  );
});

StorageVideoPlayer.displayName = 'StorageVideoPlayer';
export default StorageVideoPlayer;
