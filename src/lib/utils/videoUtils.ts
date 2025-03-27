
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
  
  // Check for URL safety check errors
  if (error.message && error.message.includes('URL safety check')) {
    return {
      message: 'Browser security blocked the video. Try refreshing the page.',
      details: `${details} - This is usually due to cross-origin restrictions with blob URLs.`
    };
  }
  
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
 * Converts a blob URL to a data URL if needed
 * This can help bypass URL safety checks in some browsers
 */
export const convertBlobToDataUrl = async (blobUrl: string): Promise<string> => {
  if (!blobUrl.startsWith('blob:')) {
    return blobUrl; // Not a blob URL, return as is
  }
  
  try {
    console.log(`Attempting to convert blob URL to data URL: ${blobUrl.substring(0, 30)}...`);
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('Successfully converted blob to data URL');
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return a string'));
        }
      };
      reader.onerror = () => {
        console.error('Failed to convert blob to data URL');
        reject(new Error('FileReader error'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting blob to data URL:', error);
    return blobUrl; // Return original URL on error
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
