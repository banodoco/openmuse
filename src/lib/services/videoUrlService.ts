
import { videoStorage } from '../storage';
import { Logger } from '../logger';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class VideoUrlService {
  private readonly logger = new Logger('VideoUrlService');
  private urlCache = new Map<string, string>();
  private refreshingUrls = new Set<string>();
  private lastRefreshAttempt = new Map<string, number>();
  
  // Minimum time between refresh attempts for the same URL (5 seconds)
  private readonly REFRESH_THROTTLE_MS = 5000;

  async getVideoUrl(videoLocation: string): Promise<string> {
    // Check if we already have this URL in cache
    if (this.urlCache.has(videoLocation)) {
      this.logger.log(`Using cached URL for ${videoLocation.substring(0, 30)}...`);
      
      // Return the cached URL, but also try to refresh it if it's a blob URL that might be expiring
      const cachedUrl = this.urlCache.get(videoLocation) || '';
      
      if (this.shouldRefreshBlobUrl(cachedUrl, videoLocation)) {
        // Don't await - do the refresh in the background
        this.refreshUrlInBackground(videoLocation);
      }
      
      return cachedUrl;
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
    // For blob URLs
    else if (videoLocation.startsWith('blob:')) {
      // If the blob URL appears expired, try to refresh it from Supabase
      if (this.isBlobUrlExpired(videoLocation)) {
        this.logger.log(`Blob URL may be expired, trying to refresh: ${videoLocation.substring(0, 30)}...`);
        try {
          // Try to get a fresh URL from the database
          const freshUrl = await this.getMediaUrlFromDatabase(videoLocation);
          if (freshUrl) {
            this.logger.log(`Successfully refreshed URL for blob: ${videoLocation.substring(0, 30)}`);
            this.urlCache.set(videoLocation, freshUrl);
            return freshUrl;
          }
        } catch (error) {
          this.logger.error(`Could not refresh expired blob URL:`, error);
        }
      }
      
      // If we get here, either the URL isn't expired or we couldn't refresh it
      this.urlCache.set(videoLocation, videoLocation);
      return videoLocation;
    }
    
    // Default case - return as is but don't cache
    return videoLocation;
  }

  // Check if we should try to refresh a blob URL
  private shouldRefreshBlobUrl(url: string, originalLocation: string): boolean {
    // Only refresh blob URLs
    if (!url.startsWith('blob:')) return false;
    
    // If we're already refreshing this URL, don't try again
    if (this.refreshingUrls.has(originalLocation)) return false;
    
    // Check if we recently tried to refresh this URL
    const lastAttempt = this.lastRefreshAttempt.get(originalLocation) || 0;
    const now = Date.now();
    
    return (now - lastAttempt) > this.REFRESH_THROTTLE_MS;
  }
  
  // Async background refresh of a URL
  private async refreshUrlInBackground(videoLocation: string): Promise<void> {
    if (this.refreshingUrls.has(videoLocation)) return;
    
    this.refreshingUrls.add(videoLocation);
    this.lastRefreshAttempt.set(videoLocation, Date.now());
    
    try {
      const freshUrl = await this.getMediaUrlFromDatabase(videoLocation);
      if (freshUrl && freshUrl !== this.urlCache.get(videoLocation)) {
        this.logger.log(`Background refresh successful for: ${videoLocation.substring(0, 30)}`);
        this.urlCache.set(videoLocation, freshUrl);
        
        // Notify any components that might be using this URL
        document.dispatchEvent(new CustomEvent('videoUrlRefreshed', { 
          detail: { original: videoLocation, fresh: freshUrl }
        }));
      }
    } catch (error) {
      this.logger.error(`Background refresh failed for: ${videoLocation.substring(0, 30)}`, error);
    } finally {
      this.refreshingUrls.delete(videoLocation);
    }
  }

  // Improved check to detect expired blob URLs
  private isBlobUrlExpired(blobUrl: string): boolean {
    // Simple initial check 
    if (!blobUrl.startsWith('blob:') || blobUrl.length < 10) {
      return true;
    }
    
    // Try to determine if the URL is from the current session
    // This heuristic assumes blob URLs from previous sessions are likely expired
    const currentOrigin = window.location.origin;
    if (!blobUrl.includes(currentOrigin)) {
      this.logger.warn(`Blob URL appears to be from a different origin: ${blobUrl.substring(0, 30)}...`);
      return true;
    }
    
    return false;
  }

  // Get a fresh URL from the database based on title or other metadata
  private async getMediaUrlFromDatabase(originalUrl: string): Promise<string | null> {
    try {
      // First try to find any media items with a matching URL
      // This assumes someone deliberately stored the blob URL in the database
      const { data: mediaByUrl } = await supabase
        .from('media')
        .select('id, url, title')
        .eq('url', originalUrl)
        .maybeSingle();
      
      if (mediaByUrl) {
        return mediaByUrl.url;
      }
      
      // If no direct match, we need to find videos by other means
      // Get all videos
      const { data: allVideos } = await supabase
        .from('media')
        .select('*')
        .eq('type', 'video');
      
      if (!allVideos || allVideos.length === 0) {
        return null;
      }
      
      // For now, we'll just use the most recent video as a fallback
      // In a real app, you'd want more sophisticated matching logic
      const mostRecentVideo = allVideos.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      
      if (mostRecentVideo && mostRecentVideo.url) {
        // Avoid returning the same URL we already have
        if (mostRecentVideo.url !== originalUrl) {
          return mostRecentVideo.url;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error fetching media from database:', error);
      return null;
    }
  }
  
  // Clean up any created object URLs
  clearCache(): void {
    this.urlCache.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.urlCache.clear();
    this.refreshingUrls.clear();
    this.lastRefreshAttempt.clear();
    this.logger.log('URL cache cleared');
  }
  
  // Force reload a video URL
  async forceRefreshUrl(videoLocation: string): Promise<string> {
    // Remove from cache if it exists
    if (this.urlCache.has(videoLocation)) {
      const oldUrl = this.urlCache.get(videoLocation);
      if (oldUrl && oldUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldUrl);
      }
      this.urlCache.delete(videoLocation);
    }
    
    // Get a fresh URL
    return this.getVideoUrl(videoLocation);
  }
}

export const videoUrlService = new VideoUrlService();
