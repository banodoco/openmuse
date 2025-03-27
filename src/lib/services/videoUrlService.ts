
import { videoStorage } from '../storage';
import { Logger } from '../logger';
import { supabase } from '@/integrations/supabase/client';

export class VideoUrlService {
  private readonly logger = new Logger('VideoUrlService');
  
  async getVideoUrl(videoLocation: string): Promise<string> {
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
      try {
        const { data } = await supabase
          .from('media')
          .select('url')
          .eq('id', videoLocation)
          .maybeSingle();
          
        if (data && data.url) {
          this.logger.log(`Found permanent URL in database: ${data.url}`);
          return data.url;
        }
      } catch (error) {
        this.logger.error('Error fetching from database:', error);
      }
    }
    
    // Default case - return as is
    return videoLocation;
  }
  
  // Force reload a video URL - simplified version
  async forceRefreshUrl(videoLocation: string): Promise<string> {
    // Check if it's a UUID and get from database
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(videoLocation)) {
      try {
        const { data } = await supabase
          .from('media')
          .select('url')
          .eq('id', videoLocation)
          .maybeSingle();
          
        if (data && data.url) {
          this.logger.log(`Got fresh URL from database: ${data.url}`);
          return data.url;
        }
      } catch (error) {
        this.logger.error('Error refreshing URL from database:', error);
      }
    }
    
    // Fall back to normal URL resolution
    return this.getVideoUrl(videoLocation);
  }
}

export const videoUrlService = new VideoUrlService();
