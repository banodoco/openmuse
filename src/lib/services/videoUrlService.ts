
import { Logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export class VideoUrlService {
  private readonly logger = new Logger('VideoUrlService');
  
  async getVideoUrl(videoLocation: string, allowBlobUrls: boolean = false): Promise<string> {
    // For empty locations, return empty
    if (!videoLocation) {
      this.logger.error('Empty video location provided');
      return '';
    }
    
    // For blob URLs, handle them based on allowBlobUrls flag
    if (videoLocation.startsWith('blob:')) {
      if (allowBlobUrls) {
        this.logger.log(`Using blob URL for preview: ${videoLocation.substring(0, 30)}...`);
        
        try {
          // Test if blob URL is still valid by fetching a head request
          const response = await fetch(videoLocation, { method: 'HEAD' }).catch(() => null);
          if (response && response.ok) {
            return videoLocation;
          } else {
            this.logger.warn(`Blob URL appears to be invalid or expired`);
            // If in preview mode, still return the URL to show error UI
            return videoLocation;
          }
        } catch (error) {
          this.logger.warn(`Error checking blob URL: ${error}`);
          return videoLocation; // Still return it in preview mode
        }
      } else {
        this.logger.warn(`Blob URL detected, ignoring as it's not permanent`);
        return '';
      }
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
    
    // For Supabase URLs, return directly
    if (videoLocation.includes('supabase.co')) {
      return videoLocation;
    }
    
    // For indexed DB storage (prefixed with idb://)
    if (videoLocation.startsWith('idb://')) {
      const videoId = videoLocation.substring(6);
      // Try database lookup for this ID
      const dbUrl = await this.lookupUrlFromDatabase(videoId);
      if (dbUrl) {
        this.logger.log(`Found permanent URL in database for idb:// ID: ${videoId}`);
        return dbUrl;
      }
      
      // If no permanent URL found, return empty
      this.logger.warn(`No permanent URL found for idb:// ID: ${videoId}`);
      return '';
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
    
    // Default - return the original location
    return videoLocation;
  }
  
  // Look up URL from database
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
        // Skip blob URLs as they're not permanent
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
    } catch (error) {
      this.logger.error('Error fetching from database:', error);
    }
    
    this.logger.error(`No URL found for ID: ${videoId}`);
    return '';
  }
  
  // Add a method to force refresh a URL (needed for LoraCard)
  async forceRefreshUrl(videoLocation: string): Promise<string> {
    if (!videoLocation) return '';
    
    this.logger.log(`Force refreshing URL for: ${videoLocation.substring(0, 30)}...`);
    
    // For blob URLs, we can't refresh them - they're temporary by nature
    if (videoLocation.startsWith('blob:')) {
      this.logger.warn(`Cannot refresh blob URL: ${videoLocation.substring(0, 30)}...`);
      return '';
    }
    
    // For database IDs, try to get a fresh URL
    try {
      // Extract UUID if present in the path
      const uuidMatch = videoLocation.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
      const possibleId = uuidMatch ? uuidMatch[1] : null;
      
      if (possibleId) {
        const freshUrl = await this.lookupUrlFromDatabase(possibleId);
        if (freshUrl) {
          this.logger.log(`Refreshed URL found: ${freshUrl.substring(0, 30)}...`);
          return freshUrl;
        }
      }
    } catch (error) {
      this.logger.error('Error force refreshing URL:', error);
    }
    
    // If all else fails, return the original location
    return videoLocation;
  }
}

export const videoUrlService = new VideoUrlService();
