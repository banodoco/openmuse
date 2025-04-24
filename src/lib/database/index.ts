import { databaseProvider } from './DatabaseProvider';
import { VideoEntry } from '../types';

/**
 * Main database interface for video operations
 * This acts as a facade over the different database implementations
 */
export class VideoDatabase {
  /**
   * Get all video entries, optionally filtering by approval status.
   * @param approvalFilter Optional filter ('all' or 'curated')
   * @returns A promise that resolves to an array of VideoEntry objects.
   */
  async getAllEntries(approvalFilter?: 'all' | 'curated'): Promise<VideoEntry[]> {
    const db = await databaseProvider.getDatabase();
    return db.getAllEntries(approvalFilter);
  }
  
  /**
   * Update a video entry
   */
  async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
    const db = await databaseProvider.getDatabase();
    return db.updateEntry(id, update);
  }
  
  /**
   * Mark a video as skipped
   */
  async markAsSkipped(id: string): Promise<VideoEntry | null> {
    const db = await databaseProvider.getDatabase();
    return db.markAsSkipped(id);
  }
  
  /**
   * Set approval status for a video
   */
  async setApprovalStatus(id: string, approved: string): Promise<VideoEntry | null> {
    const db = await databaseProvider.getDatabase();
    return db.setApprovalStatus(id, approved);
  }
  
  /**
   * Get URL for a video
   */
  async getVideoUrl(videoLocation: string): Promise<string> {
    const db = await databaseProvider.getDatabase();
    return db.getVideoUrl(videoLocation);
  }
  
  /**
   * Delete a video entry
   */
  async deleteEntry(id: string): Promise<boolean> {
    const db = await databaseProvider.getDatabase();
    return db.deleteEntry(id);
  }
  
  /**
   * Clear all video entries
   */
  async clearAllEntries(): Promise<void> {
    const db = await databaseProvider.getDatabase();
    return db.clearAllEntries();
  }
  
  /**
   * Add a new video entry
   */
  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_status' | 'user_status'>): Promise<VideoEntry> {
    const db = await databaseProvider.getDatabase();
    return db.addEntry(entry);
  }
  
  /**
   * Create a new video entry (alias for addEntry)
   */
  async createEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_status' | 'user_status'>): Promise<VideoEntry> {
    const db = await databaseProvider.getDatabase();
    return db.createEntry(entry);
  }
  
  /**
   * Set the current user ID
   */
  async setCurrentUserId(userId: string | null): Promise<void> {
    const db = await databaseProvider.getDatabase();
    db.setCurrentUserId(userId);
  }
}

// Create and export a singleton instance
export const videoDB = new VideoDatabase();
