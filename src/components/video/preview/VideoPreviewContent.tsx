
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import VideoThumbnailGenerator from '../VideoThumbnailGenerator';
import VideoPreviewError from '../VideoPreviewError';
import EmbeddedVideoPlayer from '../EmbeddedVideoPlayer';
import StandardVideoPreview from '../StandardVideoPreview';
import StorageVideoPlayer from '../../StorageVideoPlayer';
import VideoPreviewThumbnail from './VideoPreviewThumbnail';

interface VideoPreviewContentProps {
  isExternalLink: boolean;
  url?: string;
  objectUrl: string | null;
  isBlobUrl: boolean;
  file?: File;
  error: string | null;
  posterUrl: string | null;
  effectiveHoverState: boolean;
  isPlaying: boolean;
  externalIsMobile?: boolean;
  thumbnailGenerationAttempted: boolean;
  thumbnailGenerationFailed: boolean;
  needsThumbnailGeneration: boolean;
  showPlayButton: boolean;
  lazyLoad: boolean;
  forceFrameCapture: boolean;
  captureTimeout: number;
  fallbackToVideo: boolean;
  title?: string;
  creator?: string;
  onVideoError: (errorMessage: string) => void;
  onRetry: () => void;
  onThumbnailGenerated: (url: string) => void;
  onThumbnailError: () => void;
}

const VideoPreviewContent: React.FC<VideoPreviewContentProps> = ({
  isExternalLink,
  url,
  objectUrl,
  isBlobUrl,
  file,
  error,
  posterUrl,
  effectiveHoverState,
  isPlaying,
  externalIsMobile,
  thumbnailGenerationAttempted,
  thumbnailGenerationFailed,
  needsThumbnailGeneration,
  showPlayButton,
  lazyLoad,
  forceFrameCapture,
  captureTimeout,
  fallbackToVideo,
  title,
  creator,
  onVideoError,
  onRetry,
  onThumbnailGenerated,
  onThumbnailError
}) => {
  const { user } = useAuth();
  const isMobile = externalIsMobile !== undefined ? externalIsMobile : false;

  return (
    <>
      {needsThumbnailGeneration && (
        <VideoThumbnailGenerator 
          file={file}
          url={url}
          onThumbnailGenerated={onThumbnailGenerated}
          onThumbnailError={onThumbnailError}
          userId={user?.id}
          saveThumbnail={true}
          forceCapture={forceFrameCapture}
          timeout={captureTimeout}
          attemptCount={0} // This is managed in the hook via a ref
        />
      )}
      
      {isExternalLink ? (
        <EmbeddedVideoPlayer 
          url={url || ''}
          isPlaying={isPlaying && !isMobile}
          posterUrl={posterUrl}
          onTogglePlay={() => {}} // This functionality is managed by the parent
        />
      ) : file ? (
        <StandardVideoPreview 
          url={objectUrl}
          posterUrl={posterUrl}
          onError={onVideoError}
          isHovering={effectiveHoverState && !isMobile}
          isMobile={isMobile}
        />
      ) : isBlobUrl ? (
        <StorageVideoPlayer
          videoLocation={url || ''}
          controls={false} // On mobile, controls are shown by the native player when clicked
          muted={true}
          className="w-full h-full object-cover"
          playOnHover={!isMobile}
          previewMode={true}
          showPlayButtonOnHover={showPlayButton}
          autoPlay={false} // Never autoplay
          isHoveringExternally={effectiveHoverState && !isMobile}
          lazyLoad={lazyLoad}
          thumbnailUrl={posterUrl}
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
          thumbnailUrl={posterUrl}
          forcePreload={false}
          forceThumbnailGeneration={forceFrameCapture}
          captureTimeout={captureTimeout}
          fallbackToVideo={false} // Never fallback to video on mobile
          isMobile={isMobile}
        />
      ) : null}

      {error && <VideoPreviewError error={error} onRetry={() => {onRetry()}} videoSource={objectUrl || undefined} canRecover={false} />}
      
      {/* Add play button overlay */}
      <VideoPreviewThumbnail 
        posterUrl={posterUrl}
        effectiveHoverState={effectiveHoverState}
        showPlayButton={showPlayButton}
        isMobile={isMobile}
      />
    </>
  );
};

export default VideoPreviewContent;
