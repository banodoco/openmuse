
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
    
    // Check if the blob URL is accessible first
    const isAccessible = await isBlobUrlAccessible(blobUrl);
    if (!isAccessible) {
      console.warn('Blob URL is not accessible, attempting direct data URL creation');
      // Try an alternative approach for cross-domain blobs
      return createDataUrlFromImage(blobUrl);
    }
    
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    // Log blob info for debugging
    console.log(`Blob size: ${blob.size}, type: ${blob.type}`);
    
    if (blob.size === 0) {
      console.error('Blob is empty (size 0), likely invalid or expired');
      return createDataUrlFromImage(blobUrl);
    }
    
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
    // Try alternative method as fallback
    return createDataUrlFromImage(blobUrl);
  }
};

/**
 * Alternative approach to create a data URL from a blob URL
 * This uses an image element which can sometimes bypass CORS issues
 */
export const createDataUrlFromImage = (blobUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    // If it's not a blob URL, return it as is
    if (!blobUrl.startsWith('blob:')) {
      resolve(blobUrl);
      return;
    }
    
    console.log('Attempting to create data URL from image element');
    
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set crossOrigin to anonymous to try to avoid CORS issues
    img.crossOrigin = 'anonymous';
    
    // Set up a timeout to avoid hanging forever
    const timeoutId = setTimeout(() => {
      console.warn('Image loading timed out, returning original URL');
      resolve(blobUrl);
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeoutId);
      
      try {
        // Set canvas dimensions to match the image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image to canvas
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          // Get data URL from canvas
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          console.log('Successfully created data URL from image');
          resolve(dataUrl);
        } else {
          console.error('Could not get canvas context');
          resolve(blobUrl);
        }
      } catch (error) {
        console.error('Error creating data URL from image:', error);
        resolve(blobUrl);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeoutId);
      console.error('Error loading image from blob URL');
      resolve(blobUrl);
    };
    
    // Set the src to trigger loading
    img.src = blobUrl;
  });
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
    
    // Try using a HEAD request first which is more efficient
    try {
      const result = await fetch(blobUrl, { method: 'HEAD' });
      return result.ok;
    } catch (headError) {
      console.warn('HEAD request failed, falling back to GET:', headError);
    }
    
    // If HEAD failed, try a regular GET request
    try {
      const response = await fetch(blobUrl);
      return response.ok;
    } catch (getError) {
      console.error('GET request also failed:', getError);
      return false;
    }
  } catch (error) {
    console.error('Error checking blob URL accessibility:', error);
    return false;
  }
};

/**
 * Extracts information from an error's stack trace
 * Useful for debugging
 */
export const getErrorLocation = (error: Error): string => {
  try {
    if (!error.stack) return 'No stack trace available';
    
    const stackLines = error.stack.split('\n');
    // Filter out internal browser frames and keep only app code frames
    const appFrames = stackLines.filter(line => 
      line.includes('/src/') && 
      !line.includes('node_modules/')
    );
    
    return appFrames.length > 0 
      ? appFrames.slice(0, 3).join('\n') // First 3 app frames
      : stackLines.slice(0, 3).join('\n'); // First 3 frames if no app frames
  } catch (err) {
    return 'Error parsing stack trace';
  }
};
