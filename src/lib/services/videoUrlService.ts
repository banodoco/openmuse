
import { videoStorage } from '../storage';
import { Logger } from '../logger';
import { supabase } from '@/integrations/supabase/client';

export class VideoUrlService {
  private readonly logger = new Logger('VideoUrlService');
  
  async getVideoUrl(videoLocation: string): Promise<string> {
    // For empty locations, return empty
    if (!videoLocation) {
      this.logger.error('Empty video location provided');
      return '';
    }
    
    // Detect and handle expired blob URLs
    if (videoLocation.startsWith('blob:') && !this.isBlobUrlValid(videoLocation)) {
      this.logger.warn(`Blob URL appears invalid: ${videoLocation.substring(0, 50)}...`);
      // Try to extract UUID if it's from our database
      const uuidMatch = videoLocation.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
      if (uuidMatch && uuidMatch[1]) {
        return this.lookupUrlFromDatabase(uuidMatch[1]);
      }
      return '';
    }
    
    // For Supabase URLs, return directly
    if (videoLocation.includes('supabase.co')) {
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
    if (videoLocation.startsWith('http://') || videoLocation.startsWith('https://')) {
      return videoLocation;
    }
    
    // If it appears to be a UUID, look up in database
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(videoLocation)) {
      return this.lookupUrlFromDatabase(videoLocation);
    }
    
    // Default case - return as is
    return videoLocation;
  }
  
  // Check if a blob URL is likely still valid
  private isBlobUrlValid(blobUrl: string): boolean {
    // If it's not from the current origin, it's definitely invalid
    try {
      const url = new URL(blobUrl);
      if (url.origin !== window.location.origin) {
        return false;
      }
      // Additional checks could be added here
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // Helper to look up URL from database
  private async lookupUrlFromDatabase(videoId: string): Promise<string> {
    try {
      this.logger.log('Looking up media URL from database for ID:', videoId);
      const { data } = await supabase
        .from('media')
        .select('url')
        .eq('id', videoId)
        .maybeSingle();
        
      if (data && data.url) {
        // If the URL is also a blob URL, we have a problem
        if (data.url.startsWith('blob:')) {
          this.logger.warn(`Found blob URL in database: ${data.url.substring(0, 50)}... This needs to be updated.`);
          return '';
        }
        this.logger.log(`Found permanent URL in database: ${data.url.substring(0, 30)}...`);
        return data.url;
      }
    } catch (error) {
      this.logger.error('Error fetching from database:', error);
    }
    
    this.logger.error(`No URL found for ID: ${videoId}`);
    return '';
  }
  
  // Force reload a video URL - simplified version
  async forceRefreshUrl(videoLocation: string): Promise<string> {
    // Check if it's a UUID and get from database
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(videoLocation)) {
      return this.lookupUrlFromDatabase(videoLocation);
    }
    
    // For blob URLs that might be expired
    if (videoLocation.startsWith('blob:') && !this.isBlobUrlValid(videoLocation)) {
      // Try to extract UUID from the blob URL
      const uuidMatch = videoLocation.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
      if (uuidMatch && uuidMatch[1]) {
        return this.lookupUrlFromDatabase(uuidMatch[1]);
      }
    }
    
    // Fall back to normal URL resolution
    return this.getVideoUrl(videoLocation);
  }
}

export const videoUrlService = new VideoUrlService();
