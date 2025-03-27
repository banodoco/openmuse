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
  
  // Check if it's a blob URL that might have expired
  if (videoSrc.startsWith('blob:')) {
    return {
      message: 'Cannot load blob video. The URL may have expired since your last refresh.',
      details
    };
  }
  
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

/**
 * Diagnostic function to check the status of a blob URL
 */
export const diagnoseBlobUrl = async (blobUrl: string): Promise<{
  isValid: boolean;
  error?: string;
  size?: number;
  type?: string;
}> => {
  try {
    console.log(`Diagnosing blob URL: ${blobUrl}`);
    
    if (!blobUrl.startsWith('blob:')) {
      return { isValid: false, error: 'Not a blob URL' };
    }
    
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return { 
        isValid: false, 
        error: `Fetch failed with status: ${response.status} ${response.statusText}` 
      };
    }
    
    const blob = await response.blob();
    return {
      isValid: true,
      size: blob.size,
      type: blob.type
    };
  } catch (error) {
    console.error('Error diagnosing blob URL:', error);
    return {
      isValid: false,
      error: String(error)
    };
  }
};

/**
 * Tests if a blob URL is accessible
 */
export const isBlobUrlAccessible = async (blobUrl: string): Promise<boolean> => {
  try {
    if (!blobUrl.startsWith('blob:')) return false;
    
    const result = await fetch(blobUrl, { method: 'HEAD' });
    return result.ok;
  } catch (error) {
    console.error('Error checking blob URL accessibility:', error);
    return false;
  }
};
