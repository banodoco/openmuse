
import { videoStorage } from '../storage';
import { Logger } from '../logger';

export class VideoUrlService {
  private readonly logger = new Logger('VideoUrlService');
  private urlCache = new Map<string, string>();

  async getVideoUrl(videoLocation: string): Promise<string> {
    // Check if we already have this URL in cache
    if (this.urlCache.has(videoLocation)) {
      this.logger.log(`Using cached URL for ${videoLocation.substring(0, 30)}...`);
      return this.urlCache.get(videoLocation) || '';
    }
    
    // For Supabase URLs, return directly
    if (videoLocation.includes('supabase.co')) {
      // Still cache it for consistency
      this.urlCache.set(videoLocation, videoLocation);
      return videoLocation;
    }
    
    // For indexed DB storage (prefixed with idb://)
    if (videoLocation.startsWith('idb://')) {
      const videoId = videoLocation.substring(6);
      try {
        const blob = await videoStorage.getVideo(videoId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          this.logger.log(`Created object URL for video ${videoId}: ${url}`);
          
          // Cache the URL
          this.urlCache.set(videoLocation, url);
          
          return url;
        } else {
          this.logger.error(`Video not found in storage: ${videoId}`);
          return '';
        }
      } catch (error) {
        this.logger.error(`Error getting video ${videoId}:`, error);
        return '';
      }
    } 
    // For regular HTTP URLs
    else if (videoLocation.startsWith('http://') || videoLocation.startsWith('https://')) {
      // Cache the URL for consistency
      this.urlCache.set(videoLocation, videoLocation);
      return videoLocation;
    }
    // For blob URLs, just return as is
    else if (videoLocation.startsWith('blob:')) {
      // Don't cache blob URLs as they're already ephemeral
      return videoLocation;
    }
    
    // Default case - return as is but don't cache
    return videoLocation;
  }
  
  // Clean up any created object URLs
  clearCache(): void {
    this.urlCache.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.urlCache.clear();
    this.logger.log('URL cache cleared');
  }
}

export const videoUrlService = new VideoUrlService();
