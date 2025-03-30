
import React, { useState, useEffect, useRef, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import VideoThumbnailGenerator from './video/VideoThumbnailGenerator';
import VideoPreviewError from './video/VideoPreviewError';
import EmbeddedVideoPlayer from './video/EmbeddedVideoPlayer';
import StandardVideoPreview from './video/StandardVideoPreview';
import StorageVideoPlayer from './StorageVideoPlayer';
import { Logger } from '@/lib/logger';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';

const logger = new Logger('VideoPreview');

interface VideoPreviewProps {
  file?: File;
  url?: string;
  className?: string;
  title?: string;
  creator?: string;
  isHovering?: boolean;
  lazyLoad?: boolean;
  thumbnailUrl?: string;
  onTouch?: () => void;
  isMobile?: boolean;
  showPlayButton?: boolean;
  forceFrameCapture?: boolean;
  captureTimeout?: number;
  fallbackToVideo?: boolean;
}

/**
 * VideoPreview component for displaying video previews with thumbnail generation
 * and play on hover functionality.
 */
const VideoPreview: React.FC<VideoPreviewProps> = memo(({ 
  file, 
  url, 
  className,
  title,
  creator,
  isHovering: externalHoverState,
  lazyLoad = true,
  thumbnailUrl,
  onTouch,
  isMobile: externalIsMobile,
  showPlayButton = true,
  forceFrameCapture = false,
  captureTimeout = 5000,
  fallbackToVideo = false
}) => {
  const { user } = useAuth();
  const defaultIsMobile = useIsMobile();
  const isMobile = externalIsMobile !== undefined ? externalIsMobile : defaultIsMobile;
  
  const isExternalLink = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));
  const isBlobUrl = url?.startsWith('blob:');
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(thumbnailUrl || null);
  const [isHovering, setIsHovering] = useState(externalHoverState || false);
  const [internalHoverState, setInternalHoverState] = useState(false);
  const [thumbnailGenerationAttempted, setThumbnailGenerationAttempted] = useState(false);
  const [thumbnailGenerationFailed, setThumbnailGenerationFailed] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const generationAttempts = useRef(0);
  const maxGenerationAttempts = 3;
  
  useEffect(() => {
    if (thumbnailUrl) {
      logger.log(`VideoPreview: Using provided thumbnail URL: ${thumbnailUrl.substring(0, 50)}...`);
      setPosterUrl(thumbnailUrl);
    } else {
      logger.log('VideoPreview: No thumbnail URL provided, will generate if needed');
    }
  }, [thumbnailUrl]);
  
  // Calculate effective hover state - always false on mobile
  const effectiveHoverState = isMobile ? false : (externalHoverState !== undefined ? externalHoverState : internalHoverState);
  
  useEffect(() => {
    if (externalHoverState !== undefined && !isMobile) {
      logger.log(`VideoPreview: External hover state changed to ${externalHoverState}`);
      setIsHovering(externalHoverState);
      setIsPlaying(externalHoverState && !isMobile);
    }
  }, [externalHoverState, isMobile]);
  
  useEffect(() => {
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
    setIsPlaying(!isMobile); // Only set playing to true if not on mobile
    
    if (thumbnailGenerationFailed && generationAttempts.current < maxGenerationAttempts) {
      generationAttempts.current += 1;
      setThumbnailGenerationAttempted(false);
      setThumbnailGenerationFailed(false);
      
      logger.log(`Retrying thumbnail generation, attempt ${generationAttempts.current} of ${maxGenerationAttempts}`);
    }
  };

  const handleThumbnailGenerated = (thumbnailUrl: string) => {
    if (!posterUrl || thumbnailUrl !== '/placeholder.svg') {
      logger.log('Thumbnail generated:', thumbnailUrl.substring(0, 50) + '...');
      setPosterUrl(thumbnailUrl);
      setThumbnailGenerationAttempted(true);
      setThumbnailGenerationFailed(false);
    } else if (thumbnailUrl === '/placeholder.svg') {
      setThumbnailGenerationFailed(true);
      
      if (fallbackToVideo && generationAttempts.current < maxGenerationAttempts && !isMobile) {
        generationAttempts.current += 1;
        logger.log(`Thumbnail generation returned placeholder, retrying: attempt ${generationAttempts.current}`);
        setThumbnailGenerationAttempted(false);
      }
    }
  };
  
  const handleThumbnailError = () => {
    setThumbnailGenerationFailed(true);
    
    if (fallbackToVideo && !isMobile) {
      logger.log('Thumbnail generation failed, using video as fallback');
      setIsPlaying(true);
    }
  };

  const handleMouseEnter = () => {
    if (externalHoverState === undefined && !isMobile) {
      logger.log('Mouse entered video preview');
      setInternalHoverState(true);
      setIsHovering(true);
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    if (externalHoverState === undefined && !isMobile) {
      logger.log('Mouse left video preview');
      setInternalHoverState(false);
      setIsHovering(false);
      setIsPlaying(false);
    }
  };
  
  const handleTouchEvent = (e: React.TouchEvent) => {
    if (isMobile && onTouch) {
      logger.log('Touch event on video preview');
      e.preventDefault();
      onTouch();
    }
  };

  if (!file && !url) {
    return <div className={`bg-muted rounded-md aspect-video ${className}`}>No video source</div>;
  }

  const needsThumbnailGeneration = (forceFrameCapture || !thumbnailUrl || thumbnailGenerationFailed) && 
                                  (file || (url && !isExternalLink && (!posterUrl || posterUrl === '/placeholder.svg'))) && 
                                  !thumbnailGenerationAttempted;

  return (
    <div 
      ref={previewRef}
      className={`relative rounded-md overflow-hidden aspect-video ${className}`}
      onMouseEnter={isMobile ? undefined : handleMouseEnter}
      onMouseLeave={isMobile ? undefined : handleMouseLeave}
      onTouchStart={handleTouchEvent}
      data-hovering={effectiveHoverState ? "true" : "false"}
      data-mobile={isMobile ? "true" : "false"}
      data-has-thumbnail={!!posterUrl && posterUrl !== '/placeholder.svg' ? "true" : "false"}
      data-thumbnail-failed={thumbnailGenerationFailed ? "true" : "false"}
    >
      {needsThumbnailGeneration && (
        <VideoThumbnailGenerator 
          file={file}
          url={url}
          onThumbnailGenerated={handleThumbnailGenerated}
          onThumbnailError={handleThumbnailError}
          userId={user?.id}
          saveThumbnail={true}
          forceCapture={forceFrameCapture}
          timeout={captureTimeout}
          attemptCount={generationAttempts.current}
        />
      )}
      
      {isExternalLink ? (
        <EmbeddedVideoPlayer 
          url={url || ''}
          isPlaying={isPlaying && !isMobile}
          posterUrl={posterUrl}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
        />
      ) : file ? (
        <StandardVideoPreview 
          url={objectUrl}
          posterUrl={posterUrl}
          onError={(errorMessage) => setError(errorMessage)}
          isHovering={effectiveHoverState && !isMobile}
          isMobile={isMobile}
        />
      ) : isBlobUrl ? (
        <StorageVideoPlayer
          videoLocation={url}
          controls={false} // On mobile, controls are shown by the native player when clicked
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={!isMobile}
          previewMode={true}
          showPlayButtonOnHover={showPlayButton}
          autoPlay={false} // Never autoplay
          isHoveringExternally={effectiveHoverState && !isMobile}
          lazyLoad={lazyLoad}
          thumbnailUrl={thumbnailUrl || posterUrl}
          forcePreload={false}
          forceThumbnailGeneration={forceFrameCapture}
          captureTimeout={captureTimeout}
          fallbackToVideo={false} // Never fallback to video on mobile
          isMobile={isMobile}
        />
      ) : url ? (
        <StorageVideoPlayer
          videoLocation={url}
          controls={false} // On mobile, controls are shown by the native player when clicked
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={!isMobile}
          previewMode={true}
          showPlayButtonOnHover={showPlayButton}
          autoPlay={false} // Never autoplay
          isHoveringExternally={effectiveHoverState && !isMobile}
          lazyLoad={lazyLoad}
          thumbnailUrl={thumbnailUrl || posterUrl}
          forcePreload={false}
          forceThumbnailGeneration={forceFrameCapture}
          captureTimeout={captureTimeout}
          fallbackToVideo={false} // Never fallback to video on mobile
          isMobile={isMobile}
        />
      ) : null}

      {error && <VideoPreviewError error={error} onRetry={() => {setError(null); setIsPlaying(!isMobile);}} videoSource={objectUrl || undefined} canRecover={false} />}
      
      {/* Always show play button on mobile, or when not hovering on desktop */}
      {showPlayButton && posterUrl && posterUrl !== '/placeholder.svg' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`w-12 h-12 rounded-full bg-black/50 flex items-center justify-center transition-opacity ${effectiveHoverState && !isMobile ? 'opacity-0' : 'opacity-80'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';

export default VideoPreview;
