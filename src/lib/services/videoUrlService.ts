
import { videoStorage } from '../storage';
import { Logger } from '../logger';

export class VideoUrlService {
  private readonly logger = new Logger('VideoUrlService');

  async getVideoUrl(videoLocation: string): Promise<string> {
    if (videoLocation.includes('supabase.co')) {
      return videoLocation;
    }
    
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
    } else if (videoLocation.startsWith('http://') || videoLocation.startsWith('https://')) {
      return videoLocation;
    }
    
    return videoLocation;
  }
}

export const videoUrlService = new VideoUrlService();
