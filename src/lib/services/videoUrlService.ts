
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
    
    // UUID Pattern for direct database lookups
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // If it's a direct UUID, always get from database first
    if (uuidPattern.test(videoLocation)) {
      this.logger.log(`Direct UUID detected, looking up from database: ${videoLocation}`);
      const dbUrl = await this.lookupUrlFromDatabase(videoLocation);
      if (dbUrl) {
        this.logger.log(`Found permanent URL in database for UUID: ${videoLocation}`);
        return dbUrl;
      }
    }
    
    // For blob URLs, ALWAYS try to get permanent URL from database instead
    if (videoLocation.startsWith('blob:')) {
      this.logger.warn(`Blob URL detected, ignoring and attempting database lookup`);
      
      // Try to extract UUID if it's from our database
      const uuidMatch = videoLocation.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
      if (uuidMatch && uuidMatch[1]) {
        this.logger.log(`Extracted UUID from blob URL: ${uuidMatch[1]}, looking up from database`);
        const dbUrl = await this.lookupUrlFromDatabase(uuidMatch[1]);
        if (dbUrl) {
          this.logger.log(`Found permanent URL in database for blob URL`);
          return dbUrl;
        }
      }
      
      // If no permanent URL found, DON'T return the blob URL - it's likely expired
      this.logger.warn(`No permanent URL found for blob, returning empty string`);
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
        // Try database lookup first for this ID
        const dbUrl = await this.lookupUrlFromDatabase(videoId);
        if (dbUrl) {
          this.logger.log(`Found permanent URL in database for idb:// ID: ${videoId}`);
          return dbUrl;
        }
        
        // Fall back to blob URL from IndexedDB only if database lookup fails
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
    
    // For regular HTTP URLs that aren't Supabase Storage URLs
    if ((videoLocation.startsWith('http://') || videoLocation.startsWith('https://')) && !videoLocation.includes('supabase.co')) {
      // Check if this ID might be embedded in the URL
      const uuidMatch = videoLocation.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
      if (uuidMatch && uuidMatch[1]) {
        const possibleId = uuidMatch[1];
        const dbUrl = await this.lookupUrlFromDatabase(possibleId);
        if (dbUrl) {
          this.logger.log(`Found permanent URL in database for ID in URL: ${possibleId}`);
          return dbUrl;
        }
      }
      
      // No database match, return as is since it's a normal HTTP URL
      return videoLocation;
    }
    
    // If it appears to be a UUID in a path, extract and look up in database
    if (videoLocation.includes('/')) {
      const parts = videoLocation.split('/');
      for (const part of parts) {
        if (uuidPattern.test(part)) {
          this.logger.log(`Found UUID in path: ${part}, looking up from database`);
          const dbUrl = await this.lookupUrlFromDatabase(part);
          if (dbUrl) {
            return dbUrl;
          }
        }
      }
    }
    
    // Default case - if no permanent URL found, return empty string instead of temporary URLs
    if (videoLocation.startsWith('blob:')) {
      return '';
    }
    
    return videoLocation;
  }
  
  // Helper to look up URL from database - Exposed publicly now
  async lookupUrlFromDatabase(videoId: string): Promise<string> {
    try {
      this.logger.log('Looking up media URL from database for ID:', videoId);
      
      // First check if this ID is directly in the media table
      const { data: mediaData } = await supabase
        .from('media')
        .select('id, url, type')
        .eq('id', videoId)
        .maybeSingle();
        
      if (mediaData && mediaData.url) {
        // If the URL is also a blob URL, we have a problem - don't use it
        if (mediaData.url.startsWith('blob:')) {
          this.logger.warn(`Found blob URL in database: ${mediaData.url.substring(0, 50)}... Ignoring.`);
          return '';
        }
        this.logger.log(`Found permanent URL in database: ${mediaData.url.substring(0, 30)}...`);
        return mediaData.url;
      }
      
      // If not found directly, check if this ID is an asset with a primary_media_id
      const { data: assetData } = await supabase
        .from('assets')
        .select('primary_media_id')
        .eq('id', videoId)
        .maybeSingle();
        
      if (assetData && assetData.primary_media_id) {
        this.logger.log(`Found asset with primary media ID: ${assetData.primary_media_id}`);
        
        // Look up the primary media record
        const { data: primaryMedia } = await supabase
          .from('media')
          .select('url')
          .eq('id', assetData.primary_media_id)
          .maybeSingle();
          
        if (primaryMedia && primaryMedia.url) {
          if (primaryMedia.url.startsWith('blob:')) {
            this.logger.warn(`Found blob URL in primary media: ${primaryMedia.url.substring(0, 50)}... Ignoring.`);
            return '';
          }
          return primaryMedia.url;
        }
      }
      
      // Look for asset_media relationships
      const { data: assetMediaList } = await supabase
        .from('asset_media')
        .select('media_id')
        .or(`asset_id.eq.${videoId},id.eq.${videoId}`);
        
      if (assetMediaList && assetMediaList.length > 0) {
        this.logger.log(`Found ${assetMediaList.length} asset-media relations`);
        
        // Try each related media
        for (const relation of assetMediaList) {
          const { data: relatedMedia } = await supabase
            .from('media')
            .select('url')
            .eq('id', relation.media_id)
            .maybeSingle();
            
          if (relatedMedia && relatedMedia.url && !relatedMedia.url.startsWith('blob:')) {
            return relatedMedia.url;
          }
        }
      }
      
      // Last check: try direct asset_media relationship
      const { data: directAssetMedia } = await supabase
        .from('asset_media')
        .select('media_id')
        .eq('id', videoId)
        .maybeSingle();
        
      if (directAssetMedia) {
        const { data: finalMedia } = await supabase
          .from('media')
          .select('url')
          .eq('id', directAssetMedia.media_id)
          .maybeSingle();
          
        if (finalMedia && finalMedia.url && !finalMedia.url.startsWith('blob:')) {
          return finalMedia.url;
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
    this.logger.log(`Force refreshing URL for video: ${videoLocation ? videoLocation.substring(0, 30) + '...' : 'undefined'}`);
    
    // UUID pattern for direct lookups
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // If it's a direct UUID, always go to the database
    if (uuidPattern.test(videoLocation)) {
      this.logger.log(`Force refreshing URL for UUID: ${videoLocation}`);
      const dbUrl = await this.lookupUrlFromDatabase(videoLocation);
      if (dbUrl) {
        return dbUrl;
      }
    }
    
    // For blob URLs, completely ignore them and look up in the database
    if (videoLocation.startsWith('blob:')) {
      this.logger.log(`Force refreshing blob URL (ignoring blob): ${videoLocation.substring(0, 30)}...`);
      
      // Try to extract UUID from the blob URL
      const uuidMatch = videoLocation.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
      if (uuidMatch && uuidMatch[1]) {
        this.logger.log(`Extracted UUID from blob URL: ${uuidMatch[1]}`);
        const dbUrl = await this.lookupUrlFromDatabase(uuidMatch[1]);
        if (dbUrl) {
          return dbUrl;
        }
      }
      
      // No permanent URL found, return empty
      return '';
    }
    
    // Check asset ID - this is specifically for LoRA cards
    const assetIdMatch = videoLocation.match(/\/assets\/loras\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
    if (assetIdMatch && assetIdMatch[1]) {
      const assetId = assetIdMatch[1];
      this.logger.log(`Found asset ID in URL: ${assetId}, looking up primary media`);
      
      // Try to get the primary media for this asset
      const { data: assetData } = await supabase
        .from('assets')
        .select('primary_media_id')
        .eq('id', assetId)
        .maybeSingle();
        
      if (assetData && assetData.primary_media_id) {
        const dbUrl = await this.lookupUrlFromDatabase(assetData.primary_media_id);
        if (dbUrl) {
          return dbUrl;
        }
      }
    }
    
    // Check if this might be a video ID embedded in the URL
    if (videoLocation.includes('/')) {
      const parts = videoLocation.split('/');
      for (const part of parts) {
        if (uuidPattern.test(part)) {
          this.logger.log(`Found UUID in URL path: ${part}`);
          const dbUrl = await this.lookupUrlFromDatabase(part);
          if (dbUrl) {
            return dbUrl;
          }
        }
      }
    }
    
    // For all other URLs, try database first, then fall back to normal resolution
    // but never return blob: URLs
    const finalUrl = await this.getVideoUrl(videoLocation);
    if (finalUrl.startsWith('blob:')) {
      return '';
    }
    
    return finalUrl;
  }
}

export const videoUrlService = new VideoUrlService();
