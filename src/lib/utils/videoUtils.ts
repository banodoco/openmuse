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
  
  // Include HLS/DASH manifests (e.g., .m3u8, .mpd) and common video extensions
  const hasVideoExtension = /\.(mp4|webm|ogg|mov|avi|m3u8|mpd)($|\?)/i.test(url);
  
  // If it has a video extension, it's likely valid
  if (hasVideoExtension) return true;
  
  // If it's from common video hosts, it's likely valid
  const isFromVideoHost =
    // Generic Cloudflare domain (e.g., cdn-cgi, videodelivery)
    url.includes('cloudflare.com') ||
    // Cloudflare Stream customer subdomains (customer-<id>.cloudflarestream.com)
    url.includes('cloudflarestream.com') ||
    // Older Cloudflare Stream domain
    url.includes('videodelivery.net') ||
    // Supabase Storage
    url.includes('supabase.co') ||
    // Amazon S3 / CloudFront
    url.includes('amazonaws.com');
  
  return isFromVideoHost;
};

/**
 * Checks if an image source is likely to be a valid image URL (for thumbnails)
 */
export const isValidImageUrl = (url: string | null): boolean => {
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
      if (blobUrl.origin !== window.location.origin) {
        console.warn('Blob URL from different origin detected (image):', url);
        return false;
      }
    } catch (e) {
      console.warn('Invalid blob URL detected (image):', url);
      return false;
    }
  }

  // Simple extension check for common image formats
  const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg)($|\?)/i.test(url);
  if (hasImageExtension) return true;

  // If it's from common image hosts, it's likely valid
  const isFromImageHost = url.includes('cloudflare.com') ||
                         url.includes('supabase.co') ||
                         url.includes('amazonaws.com');

  return isFromImageHost;
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
    if (ext === 'm3u8') {
      return 'HLS';
    }
  }
  
  // If URL contains hints about the format
  if (url.includes('format=mp4') || url.includes('content-type=video/mp4')) {
    return 'MP4';
  }
  if (url.includes('format=webm') || url.includes('content-type=video/webm')) {
    return 'WEBM';
  }
  if (url.includes('.m3u8') || url.includes('format=m3u8') || url.includes('hls')) {
    return 'HLS';
  }
  
  // Default assumption for common hosts
  if (url.includes('supabase.co')) {
    return 'MP4'; // Supabase typically serves MP4
  }
  if (url.includes('cloudflarestream.com') || url.includes('videodelivery.net')) {
    return 'HLS';
  }
  
  return 'Unknown';
};

/**
 * Defines the order for video display statuses.
 */
// Define order using valid VideoDisplayStatus values
// Aligned with the simplified VideoDisplayStatus type
const statusOrder: { [key in VideoDisplayStatus]?: number } = {
  Pinned: 1,   // Pinned first
  Listed: 2,   // Listed second
  Hidden: 3,   // Hidden last
};

/**
 * Sorts videos for an asset detail page based on a specific order:
 * 1. Display Status (Pinned > Listed > Hidden)
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
  // Define order using the user-settable VideoDisplayStatus values
  const VIDEO_DISPLAY_STATUS_ORDER: { [key in VideoDisplayStatus]?: number } = {
    Pinned: 1,
    Listed: 2,
    Hidden: 3,
  };

  return [...videos].sort((a, b) => {
    // 1) Display status order (using assetMediaDisplayStatus)
    // Default to 'Listed' if assetMediaDisplayStatus is null/undefined or invalid
    const statusA = a.assetMediaDisplayStatus || 'Listed';
    const statusB = b.assetMediaDisplayStatus || 'Listed';
    // Use default Listed order (2) if status not in map
    const orderA = VIDEO_DISPLAY_STATUS_ORDER[statusA as VideoDisplayStatus] ?? 2;
    const orderB = VIDEO_DISPLAY_STATUS_ORDER[statusB as VideoDisplayStatus] ?? 2;

    const statusDiff = orderA - orderB;
    if (statusDiff !== 0) return statusDiff;

    // 2) Primary media first (within the same status)
    const aIsPrimary = a.id === primaryMediaId;
    const bIsPrimary = b.id === primaryMediaId;
    if (aIsPrimary !== bIsPrimary) return aIsPrimary ? -1 : 1;

    // 3) Removed Admin Featured check - was likely part of the reverted changes
    // const aIsFeatured = a.admin_status === 'Featured';
    // const bIsFeatured = b.admin_status === 'Featured';
    // if (aIsFeatured !== bIsFeatured) return aIsFeatured ? -1 : 1;

    // 4) Finally, most recent first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};
