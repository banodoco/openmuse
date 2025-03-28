
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
      
      // Additional check: try to fetch the blob to test validity
      try {
        fetch(blobUrl, { method: 'HEAD' })
          .catch(() => {
            // Fetch will fail for invalid blob URLs
            return false;
          });
      } catch (e) {
        return false;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // Helper to look up URL from database - Exposed publicly now
  async lookupUrlFromDatabase(videoId: string): Promise<string> {
    try {
      this.logger.log('Looking up media URL from database for ID:', videoId);
      // First try the media table
      const { data: mediaData } = await supabase
        .from('media')
        .select('url')
        .eq('id', videoId)
        .maybeSingle();
        
      if (mediaData && mediaData.url) {
        // If the URL is also a blob URL, we have a problem
        if (mediaData.url.startsWith('blob:')) {
          this.logger.warn(`Found blob URL in database: ${mediaData.url.substring(0, 50)}... This needs to be updated.`);
          return '';
        }
        this.logger.log(`Found permanent URL in database: ${mediaData.url.substring(0, 30)}...`);
        return mediaData.url;
      }
      
      // If not found, try checking if there's an asset with this primary_media_id
      const { data: assetData } = await supabase
        .from('assets')
        .select('id')
        .eq('primary_media_id', videoId)
        .maybeSingle();
        
      if (assetData) {
        this.logger.log(`Found asset with primary media ID ${videoId}`);
        // Now try to get the actual media record again
        const { data: mediaLookup } = await supabase
          .from('media')
          .select('url')
          .eq('id', videoId)
          .maybeSingle();
          
        if (mediaLookup && mediaLookup.url) {
          return mediaLookup.url;
        }
      }
      
      // Last resort: check asset_media join table
      const { data: assetMediaData } = await supabase
        .from('asset_media')
        .select('media_id')
        .eq('id', videoId)
        .maybeSingle();
        
      if (assetMediaData) {
        const mediaId = assetMediaData.media_id;
        const { data: relatedMedia } = await supabase
          .from('media')
          .select('url')
          .eq('id', mediaId)
          .maybeSingle();
          
        if (relatedMedia && relatedMedia.url) {
          return relatedMedia.url;
        }
      }
    } catch (error) {
      this.logger.error('Error fetching from database:', error);
    }
    
    this.logger.error(`No URL found for ID: ${videoId}`);
    return '';
  }
  
  // Force reload a video URL
  async forceRefreshUrl(videoLocation: string): Promise<string> {
    // Check if it's a UUID and get from database
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(videoLocation)) {
      this.logger.log(`Force refreshing URL for video ID: ${videoLocation}`);
      return this.lookupUrlFromDatabase(videoLocation);
    }
    
    // For blob URLs that might be expired
    if (videoLocation.startsWith('blob:')) {
      this.logger.log(`Force refreshing blob URL: ${videoLocation.substring(0, 30)}...`);
      // Try to extract UUID from the blob URL
      const uuidMatch = videoLocation.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
      if (uuidMatch && uuidMatch[1]) {
        this.logger.log(`Extracted UUID from blob URL: ${uuidMatch[1]}`);
        return this.lookupUrlFromDatabase(uuidMatch[1]);
      }
      
      // Check if we can extract the UUID from the pathname
      try {
        const url = new URL(videoLocation);
        const pathParts = url.pathname.split('/');
        // Look for a part that looks like a UUID
        for (const part of pathParts) {
          if (uuidPattern.test(part)) {
            this.logger.log(`Found UUID in path: ${part}`);
            return this.lookupUrlFromDatabase(part);
          }
        }
      } catch (e) {
        this.logger.error('Error parsing blob URL:', e);
      }
    }
    
    // Check if this might be a video ID embedded in the URL
    if (videoLocation.includes('/')) {
      const parts = videoLocation.split('/');
      for (const part of parts) {
        if (uuidPattern.test(part)) {
          this.logger.log(`Found UUID in URL path: ${part}`);
          return this.lookupUrlFromDatabase(part);
        }
      }
    }
    
    // Fall back to normal URL resolution
    return this.getVideoUrl(videoLocation);
  }
}

export const videoUrlService = new VideoUrlService();
