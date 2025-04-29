import { VideoEntry, VideoDisplayStatus, AdminStatus } from '@/lib/types';

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
    // Special case for blob URLs that might be invalid
    if (videoSrc.startsWith('blob:')) {
      // Try to fetch the blob to see if it's valid
      return { 
        message: 'Invalid video source: ' + videoSrc.substring(0, 30) + '...', 
        details: `The blob URL may have expired. Try refreshing the page.`
      };
    }
    
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
        details: `${details}. This may be because the video format (like WebM, MP4, etc.) is not supported by this browser or the video is corrupted.`
      };
    default:
      return {
        message: `Video error (code ${error.code})`,
        details
      };
  }
};

/**
 * Checks if a video source is likely to be a playable video URL
 */
export const isValidVideoUrl = (url: string | null): boolean => {
  if (!url) return false;
  
  // Check if it's a URL (either http, https, or blob)
  const isUrl = url.startsWith('http://') || 
                url.startsWith('https://') || 
                url.startsWith('blob:');
  
  if (!isUrl) return false;
  
  // For blob URLs, do a quick validity check
  if (url.startsWith('blob:')) {
    try {
      const blobUrl = new URL(url);
      // If the blob is from a different origin, it's definitely not valid
      if (blobUrl.origin !== window.location.origin) {
        console.warn('Blob URL from different origin detected:', url);
        return false;
      }
    } catch (e) {
      console.warn('Invalid blob URL detected:', url);
      return false;
    }
  }
  
  // Simple extension check for common video formats
  const hasVideoExtension = /\.(mp4|webm|ogg|mov|avi)($|\?)/i.test(url);
  
  // If it has a video extension, it's likely valid
  if (hasVideoExtension) return true;
  
  // If it's from common video hosts, it's likely valid
  const isFromVideoHost = url.includes('cloudflare.com') || 
                         url.includes('supabase.co') || 
                         url.includes('amazonaws.com');
  
  return isFromVideoHost;
};

/**
 * Tries to determine the format of a video from its URL
 */
export const getVideoFormat = (url: string): string => {
  // Check for blob URLs first
  if (url.startsWith('blob:')) {
    return 'BLOB';
  }
  
  // Extract extension if present
  const extensionMatch = url.match(/\.([a-z0-9]+)($|\?)/i);
  if (extensionMatch && extensionMatch[1]) {
    const ext = extensionMatch[1].toLowerCase();
    if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) {
      return ext.toUpperCase();
    }
  }
  
  // If URL contains hints about the format
  if (url.includes('format=mp4') || url.includes('content-type=video/mp4')) {
    return 'MP4';
  }
  if (url.includes('format=webm') || url.includes('content-type=video/webm')) {
    return 'WEBM';
  }
  
  // Default assumption for common hosts
  if (url.includes('supabase.co')) {
    return 'MP4'; // Supabase typically serves MP4
  }
  
  return 'Unknown';
};

/**
 * Defines the order for video display statuses.
 */
// Define order using valid AdminStatus values + 'View' if needed
const statusOrder: { [key in AdminStatus | 'View']?: number } = {
  Featured: 1,
  Curated: 2,
  Listed: 3,
  View: 4,     // View status (if still used separately from Listed)
  Hidden: 5,   // Hidden last among interactable statuses
  Rejected: 6, // Rejected very last
};

/**
 * Sorts videos for an asset detail page based on a specific order:
 * 1. Display Status (Pinned > View > Hidden)
 * 2. Primary Video first within the same status
 * 3. Admin Featured videos next within the same status
 * 4. Finally, by creation date (newest first)
 *
 * @param videos - The array of VideoEntry objects to sort.
 * @param primaryMediaId - The ID of the primary media for the asset, if any.
 * @returns A new array with the sorted videos.
 */
export const sortAssetPageVideos = (
  videos: VideoEntry[],
  primaryMediaId: string | null | undefined
): VideoEntry[] => {
  // Define order using valid AdminStatus values
  const statusOrder: { [key in AdminStatus]?: number } = {
    Featured: 1,
    Curated: 2,
    Listed: 3,
    Hidden: 4,
    Rejected: 5,
  };

  return [...videos].sort((a, b) => {
    // 1) Status order
    const statusA = a.admin_status || 'Listed'; // Default to Listed if null
    const statusB = b.admin_status || 'Listed'; // Default to Listed if null
    const orderA = statusOrder[statusA] ?? 99; // Get order, fallback to large number
    const orderB = statusOrder[statusB] ?? 99; // Get order, fallback to large number

    const statusDiff = orderA - orderB;
    if (statusDiff !== 0) return statusDiff;

    // 2) Primary media first (within the same status)
    const aIsPrimary = a.id === primaryMediaId;
    const bIsPrimary = b.id === primaryMediaId;
    if (aIsPrimary !== bIsPrimary) return aIsPrimary ? -1 : 1;

    // 3) Admin Featured videos next (within the same status and primary status)
    const aIsFeatured = a.admin_status === 'Featured';
    const bIsFeatured = b.admin_status === 'Featured';
    if (aIsFeatured !== bIsFeatured) return aIsFeatured ? -1 : 1;

    // 4) Finally, most recent first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};
