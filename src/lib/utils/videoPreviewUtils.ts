
/**
 * Utilities for handling videos in the preview component
 */

/**
 * Extracts YouTube video ID from different YouTube URL formats
 */
export const getYoutubeVideoId = (youtubeUrl: string): string | null => {
  if (!youtubeUrl) return null;
  
  let videoId = null;
  if (youtubeUrl.includes('youtube.com/watch')) {
    try {
      const urlObj = new URL(youtubeUrl);
      videoId = urlObj.searchParams.get('v');
    } catch (e) {
      console.error('Invalid YouTube URL', e);
    }
  } 
  else if (youtubeUrl.includes('youtu.be/')) {
    try {
      videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
    } catch (e) {
      console.error('Error parsing shortened YouTube URL', e);
    }
  }
  
  return videoId;
};

/**
 * Generates an embed URL for different video platforms
 */
export const getEmbedUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  
  let embedUrl = null;
  
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
    const youtubeId = getYoutubeVideoId(url);
    if (youtubeId) {
      embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
    }
  } 
  else if (url.includes('vimeo.com/')) {
    const vimeoId = url.split('/').pop()?.split('?')[0];
    if (vimeoId) {
      embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
    }
  }
  
  return embedUrl;
};

/**
 * Get default title from a URL or filename
 */
export const getDefaultTitleFromUrl = (url: string): string => {
  try {
    // For YouTube links, try to extract the video ID
    if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
      const videoId = getYoutubeVideoId(url) || 'YouTube Video';
      return `YouTube Video - ${videoId}`;
    } 
    // For Vimeo links
    else if (url.includes('vimeo.com/')) {
      const videoId = url.split('/').pop() || 'Vimeo Video';
      return `Vimeo Video - ${videoId}`;
    }
    // For direct video links
    else {
      const fileName = url.split('/').pop() || 'Video';
      const fileNameWithoutExtension = fileName.split('.').slice(0, -1).join('.');
      return fileNameWithoutExtension || fileName;
    }
  } catch (e) {
    // If URL parsing fails, use a generic title
    return 'External Video';
  }
};
