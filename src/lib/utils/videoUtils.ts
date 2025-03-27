
/**
 * Attempts to play a video with error handling
 */
export const attemptVideoPlay = async (video: HTMLVideoElement, muted = true) => {
  try {
    // Ensure video is muted to allow autoplay in most browsers
    video.muted = muted;
    
    // Use the play() Promise to catch autoplay restrictions
    await video.play();
    return true;
  } catch (err) {
    console.error('Error playing video:', err);
    return false;
  }
};

/**
 * Gets a user-friendly error message from a video error
 */
export const getVideoErrorMessage = (
  error: MediaError | null, 
  videoSrc: string
): { message: string, details: string } => {
  if (!error) {
    return { 
      message: 'Unknown video error', 
      details: `No MediaError available. Video source: ${videoSrc}`
    };
  }
  
  const details = `Media error ${error.code}: ${error.message || 'No message provided'} for source: ${videoSrc}`;
  
  // Standard error codes from the MediaError interface
  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return {
        message: 'Video playback aborted by user or system',
        details
      };
    case MediaError.MEDIA_ERR_NETWORK:
      return {
        message: 'Network error while loading video',
        details
      };
    case MediaError.MEDIA_ERR_DECODE:
      return {
        message: 'Video format error or decoding failed',
        details
      };
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return {
        message: 'Video format or type not supported by browser',
        details
      };
    default:
      return {
        message: `Video error (code ${error.code})`,
        details
      };
  }
};
