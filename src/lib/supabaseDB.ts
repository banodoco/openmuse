import { VideoEntry } from './types';
import { videoEntryService } from './services/videoEntryService';
import { videoUploadService } from './services/videoUploadService';
import { videoUrlService } from './services/videoUrlService';
import { Logger } from './logger';

class SupabaseVideoDatabase {
  private readonly logger = new Logger('SupabaseDB');
  private currentUserId: string | null = null;
  
  setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
    this.logger.log(`Current user ID set to: ${userId || 'none'}`);
    
    // Propagate user ID to all services
    videoEntryService.setCurrentUserId(userId);
    videoUploadService.setCurrentUserId(userId);
  }
  
  async getAllEntries(): Promise<VideoEntry[]> {
    return videoEntryService.getAllEntries();
  }
  
  async getRandomPendingEntry(): Promise<VideoEntry | null> {
    return videoEntryService.getRandomPendingEntry();
  }
  
  async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
    return videoEntryService.updateEntry(id, update);
  }
  
  async markAsSkipped(id: string): Promise<VideoEntry | null> {
    return videoEntryService.markAsSkipped(id);
  }
  
  async setApprovalStatus(id: string, approved: boolean): Promise<VideoEntry | null> {
    return videoEntryService.setApprovalStatus(id, approved);
  }
  
  async deleteEntry(id: string): Promise<boolean> {
    return videoEntryService.deleteEntry(id);
  }
  
  async getVideoUrl(videoLocation: string): Promise<string> {
    return videoUrlService.getVideoUrl(videoLocation);
  }
  
  async clearAllEntries(): Promise<void> {
    return videoEntryService.clearAllEntries();
  }
  
  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    return videoUploadService.addEntry(entry);
  }
  
  async saveActingVideo(id: string, actingVideoLocation: string): Promise<VideoEntry | null> {
    return videoUploadService.saveActingVideo(id, actingVideoLocation);
  }
}

export const supabaseDB = new SupabaseVideoDatabase();
