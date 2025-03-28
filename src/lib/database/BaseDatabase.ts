
import { VideoEntry } from '../types';
import { Logger } from '../logger';

/**
 * Abstract base class for video database implementations
 */
export abstract class BaseDatabase {
  protected logger: Logger;
  protected currentUserId: string | null = null;
  
  constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }
  
  setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
    this.logger.log(`Current user ID set to: ${userId || 'none'}`);
  }
  
  // Core methods that all database implementations must provide
  abstract getAllEntries(): Promise<VideoEntry[]>;
  abstract updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null>;
  abstract markAsSkipped(id: string): Promise<VideoEntry | null>;
  abstract setApprovalStatus(id: string, approved: string): Promise<VideoEntry | null>;
  abstract getVideoUrl(videoLocation: string): Promise<string>;
  abstract deleteEntry(id: string): Promise<boolean>;
  abstract clearAllEntries(): Promise<void>;
  abstract addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry>;
  
  // Common alias for addEntry
  async createEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    this.logger.log('createEntry called, using addEntry method');
    return this.addEntry(entry);
  }
}
