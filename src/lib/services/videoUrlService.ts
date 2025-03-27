
import { videoStorage } from '../storage';
import { Logger } from '../logger';
import { supabase } from '@/integrations/supabase/client';

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
      // For blob URLs that appear expired, check if we can fetch from Supabase directly
      if (videoLocation.startsWith('blob:') && this.isBlobUrlExpired(videoLocation)) {
        this.logger.log(`Blob URL expired, trying to refresh from Supabase: ${videoLocation.substring(0, 30)}...`);
        try {
          // Try to fetch the video from Supabase using the media ID
          // This assumes the video ID can be extracted from metadata
          // This is a simplified approach - you may need more complex logic
          const videoId = this.extractVideoIdFromBlobUrl(videoLocation);
          if (videoId) {
            const { data } = await supabase.from('media').select('url').eq('id', videoId).single();
            if (data && data.url) {
              this.logger.log(`Retrieved fresh URL for video ${videoId}`);
              this.urlCache.set(videoLocation, data.url);
              return data.url;
            }
          }
        } catch (error) {
          this.logger.error(`Could not refresh expired blob URL:`, error);
        }
      }
      
      // Cache the URL for consistency
      this.urlCache.set(videoLocation, videoLocation);
      return videoLocation;
    }
    // For blob URLs, treat differently to ensure freshness
    else if (videoLocation.startsWith('blob:')) {
      // Don't cache blob URLs as they're already ephemeral
      // If we can access it, return as is
      if (!this.isBlobUrlExpired(videoLocation)) {
        return videoLocation;
      } else {
        this.logger.warn(`Blob URL appears expired: ${videoLocation.substring(0, 30)}...`);
        return '';
      }
    }
    
    // Default case - return as is but don't cache
    return videoLocation;
  }

  // Simple check to attempt to detect expired blob URLs
  private isBlobUrlExpired(blobUrl: string): boolean {
    // This is a simplified check - in a real implementation, 
    // you might want to use fetch() to verify if the URL is still valid
    try {
      // We can't fully check without attempting to fetch,
      // but this detects some common issues
      return !blobUrl.startsWith('blob:') || blobUrl.length < 10;
    } catch {
      return true;
    }
  }

  // Extract video ID from blob URL if possible
  private extractVideoIdFromBlobUrl(blobUrl: string): string | null {
    // This is a placeholder implementation
    // In reality, the blob URL doesn't inherently contain the video ID
    // You would need application-specific logic to map blob URLs to video IDs
    return null;
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
