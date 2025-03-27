import { videoStorage } from '../storage';
import { Logger } from '../logger';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCachedDataUrl } from '../utils/videoUtils';

export class VideoUrlService {
  private readonly logger = new Logger('VideoUrlService');
  private urlCache = new Map<string, string>();
  private refreshingUrls = new Set<string>();
  private lastRefreshAttempt = new Map<string, number>();
  
  // Minimum time between refresh attempts for the same URL (5 seconds)
  private readonly REFRESH_THROTTLE_MS = 5000;
  // Key prefix for localStorage
  private readonly LOCALSTORAGE_PREFIX = 'video_url_';

  async getVideoUrl(videoLocation: string): Promise<string> {
    // First try to get from localStorage for maximum persistence
    const persistedUrl = this.getPersistedUrl(videoLocation);
    if (persistedUrl) {
      this.logger.log(`Using persisted URL for ${videoLocation.substring(0, 30)}...`);
      // Cache it in memory too
      this.urlCache.set(videoLocation, persistedUrl);
      return persistedUrl;
    }
    
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
      this.persistUrl(videoLocation, videoLocation);
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
      this.persistUrl(videoLocation, videoLocation);
      return videoLocation;
    }
    // For blob URLs
    else if (videoLocation.startsWith('blob:')) {
      // If the blob URL appears expired, try to refresh it from Supabase
      if (this.isBlobUrlExpired(videoLocation)) {
        this.logger.log(`Blob URL may be expired, trying to refresh: ${videoLocation.substring(0, 30)}...`);
        try {
          // Check for cached data URL from videoUtils first
          const cachedDataUrl = getCachedDataUrl(videoLocation);
          if (cachedDataUrl) {
            this.logger.log(`Found cached data URL for blob: ${videoLocation.substring(0, 30)}`);
            this.urlCache.set(videoLocation, cachedDataUrl);
            this.persistUrl(videoLocation, cachedDataUrl);
            return cachedDataUrl;
          }
          
          // Try to get a fresh URL from the database
          const freshUrl = await this.getMediaUrlFromDatabase(videoLocation);
          if (freshUrl) {
            this.logger.log(`Successfully refreshed URL for blob: ${videoLocation.substring(0, 30)}`);
            this.urlCache.set(videoLocation, freshUrl);
            this.persistUrl(videoLocation, freshUrl);
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

  // Persist a URL to localStorage for maximum durability
  private persistUrl(originalLocation: string, url: string): void {
    try {
      if (!url || !originalLocation) return;
      
      // Don't persist blob URLs directly as they're temporary
      if (url.startsWith('blob:')) return;
      
      // Create a key based on the original location
      const key = `${this.LOCALSTORAGE_PREFIX}${this.getStorageKey(originalLocation)}`;
      localStorage.setItem(key, url);
      this.logger.log(`Persisted URL to localStorage with key: ${key}`);
    } catch (error) {
      this.logger.warn('Failed to persist URL to localStorage:', error);
    }
  }
  
  // Get a persisted URL from localStorage
  private getPersistedUrl(originalLocation: string): string | null {
    try {
      const key = `${this.LOCALSTORAGE_PREFIX}${this.getStorageKey(originalLocation)}`;
      const value = localStorage.getItem(key);
      
      if (value) {
        this.logger.log(`Retrieved persisted URL from localStorage with key: ${key}`);
      }
      
      return value;
    } catch (error) {
      this.logger.warn('Failed to get persisted URL from localStorage:', error);
      return null;
    }
  }
  
  // Create a consistent storage key from a URL
  private getStorageKey(url: string): string {
    // If it's a UUID, use it directly
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = url.match(uuidPattern);
    if (match) {
      return match[0];
    }
    
    // Otherwise, create a hash-like key from the URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
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
        this.persistUrl(videoLocation, freshUrl);
        
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
      // First try to find the video by ID
      const videoId = this.extractIdFromUrl(originalUrl) || this.getStorageKey(originalUrl);
      if (videoId) {
        const { data: mediaById } = await supabase
          .from('media')
          .select('id, url, title')
          .eq('id', videoId)
          .maybeSingle();
          
        if (mediaById && mediaById.url) {
          this.logger.log(`Found video by ID: ${videoId}`);
          return mediaById.url;
        }
      }
      
      // Next try to find by exact URL
      const { data: mediaByUrl } = await supabase
        .from('media')
        .select('id, url, title')
        .eq('url', originalUrl)
        .maybeSingle();
      
      if (mediaByUrl && mediaByUrl.url) {
        this.logger.log(`Found video by exact URL match`);
        return mediaByUrl.url;
      }
      
      // Finally, search by a portion of the URL that might be in the database
      const blobId = originalUrl.split('/').pop();
      if (blobId && blobId.length > 10) {
        const { data: mediaByPartialUrl } = await supabase
          .from('media')
          .select('id, url, title')
          .ilike('url', `%${blobId}%`)
          .maybeSingle();
          
        if (mediaByPartialUrl && mediaByPartialUrl.url) {
          this.logger.log(`Found video by partial URL match: ${blobId}`);
          return mediaByPartialUrl.url;
        }
      }
      
      // If no direct match, get the requested video from the asset media relationship
      // This is useful on the asset details page
      const currentRoute = window.location.pathname;
      const assetIdMatch = currentRoute.match(/assets\/loras\/([0-9a-f-]+)/i);
      if (assetIdMatch && assetIdMatch[1]) {
        const assetId = assetIdMatch[1];
        this.logger.log(`Current route suggests asset ID: ${assetId}`);
        
        // Query the asset_media table to get all media for this asset
        const { data: assetMedia } = await supabase
          .from('asset_media')
          .select('media_id')
          .eq('asset_id', assetId);
          
        if (assetMedia && assetMedia.length > 0) {
          // Get all media IDs for this asset
          const mediaIds = assetMedia.map(item => item.media_id);
          
          // Query the media table for these IDs
          const { data: assetVideos } = await supabase
            .from('media')
            .select('id, url, title')
            .in('id', mediaIds)
            .eq('type', 'video');
            
          if (assetVideos && assetVideos.length > 0) {
            this.logger.log(`Found ${assetVideos.length} videos for asset ${assetId}`);
            // Find the video with ID in the current URL if possible
            const currentVideoId = window.location.pathname.split('/').pop();
            const matchingVideo = assetVideos.find(v => v.id === currentVideoId);
            
            if (matchingVideo && matchingVideo.url) {
              this.logger.log(`Found matching video for current path: ${currentVideoId}`);
              return matchingVideo.url;
            }
            
            // Otherwise just return the first video
            return assetVideos[0].url;
          }
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error fetching media from database:', error);
      return null;
    }
  }
  
  // Extract ID from URL if present
  private extractIdFromUrl(url: string): string | null {
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = url.match(uuidPattern);
    return match ? match[0] : null;
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
    
    // Try to get fresh URL from database first
    try {
      const freshUrl = await this.getMediaUrlFromDatabase(videoLocation);
      if (freshUrl) {
        this.logger.log(`Got fresh URL from database: ${freshUrl.substring(0, 30)}...`);
        this.urlCache.set(videoLocation, freshUrl);
        this.persistUrl(videoLocation, freshUrl);
        return freshUrl;
      }
    } catch (error) {
      this.logger.error('Error refreshing URL from database:', error);
    }
    
    // Fall back to normal URL resolution
    return this.getVideoUrl(videoLocation);
  }
}

export const videoUrlService = new VideoUrlService();
