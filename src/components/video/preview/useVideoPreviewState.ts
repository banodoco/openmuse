
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';

const logger = new Logger('useVideoPreviewState');

interface UseVideoPreviewStateProps {
  file?: File;
  url?: string;
  externalHoverState?: boolean;
  lazyLoad?: boolean;
  thumbnailUrl?: string | null;
  forceFrameCapture?: boolean;
  captureTimeout?: number;
  fallbackToVideo?: boolean;
  onTouch?: () => void;
  externalIsMobile?: boolean;
}

export function useVideoPreviewState({
  file,
  url,
  externalHoverState,
  lazyLoad = true,
  thumbnailUrl,
  forceFrameCapture = false,
  captureTimeout = 5000,
  fallbackToVideo = false,
  onTouch,
  externalIsMobile
}: UseVideoPreviewStateProps) {
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

  const needsThumbnailGeneration = (forceFrameCapture || !thumbnailUrl || thumbnailGenerationFailed) && 
                                  (file || (url && !isExternalLink && (!posterUrl || posterUrl === '/placeholder.svg'))) && 
                                  !thumbnailGenerationAttempted;

  return {
    objectUrl,
    isExternalLink,
    isBlobUrl,
    isPlaying,
    error,
    posterUrl,
    effectiveHoverState,
    thumbnailGenerationAttempted,
    thumbnailGenerationFailed,
    needsThumbnailGeneration,
    handleVideoError,
    handleRetry,
    handleThumbnailGenerated,
    handleThumbnailError,
    handleMouseEnter,
    handleMouseLeave,
    handleTouchEvent
  };
}
