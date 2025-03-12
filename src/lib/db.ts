
import { VideoEntry } from './types';
import { videoStorage } from './storage';

class VideoDatabase {
  private readonly VIDEO_KEY = 'video_response_entries';
  private readonly DEBUG = true;
  
  private getAll(): VideoEntry[] {
    try {
      const entries = localStorage.getItem(this.VIDEO_KEY);
      
      if (!entries) {
        this.log('No entries found in localStorage, returning empty array');
        return [];
      }
      
      let parsedEntries;
      try {
        parsedEntries = JSON.parse(entries);
      } catch (parseError) {
        this.error('Failed to parse entries from localStorage:', parseError);
        return [];
      }
      
      if (!Array.isArray(parsedEntries)) {
        this.error('Retrieved data is not an array, returning empty array');
        return [];
      }
      
      this.log(`Retrieved ${parsedEntries.length} entries from localStorage`);
      return parsedEntries;
    } catch (error) {
      this.error('Error getting entries from localStorage:', error);
      return [];
    }
  }
  
  private save(entries: VideoEntry[]): void {
    try {
      localStorage.setItem(this.VIDEO_KEY, JSON.stringify(entries));
      this.log(`Saved ${entries.length} entries to localStorage`);
    } catch (error) {
      this.error('Error saving entries to localStorage:', error);
    }
  }
  
  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    const entries = this.getAll();
    const id = crypto.randomUUID();
    
    let videoLocation = entry.video_location;
    
    // If it's a blob URL, fetch the blob and save it to IndexedDB
    if (entry.video_location.startsWith('blob:')) {
      try {
        const response = await fetch(entry.video_location);
        const blob = await response.blob();
        
        // Save the video blob to IndexedDB
        await videoStorage.saveVideo({
          id: `video_${id}`,
          blob
        });
        
        // Use a reference to the video in IndexedDB
        videoLocation = `idb://video_${id}`;
        this.log(`Saved video to IndexedDB with ID: video_${id}`);
      } catch (error) {
        this.error('Failed to save video to IndexedDB:', error);
        throw error;
      }
    }
    
    const newEntry: VideoEntry = {
      ...entry,
      video_location: videoLocation,
      id,
      created_at: new Date().toISOString(),
      admin_approved: false
    };
    
    this.save([...entries, newEntry]);
    this.log(`Added new entry: ${newEntry.id}`);
    return newEntry;
  }
  
  getRandomPendingEntry(): VideoEntry | null {
    const entries = this.getAll();
    const pendingEntries = entries.filter(
      entry => !entry.acting_video_location && !entry.skipped
    );
    
    if (pendingEntries.length === 0) {
      this.log('No pending entries found');
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * pendingEntries.length);
    const selectedEntry = pendingEntries[randomIndex];
    this.log(`Selected random pending entry: ${selectedEntry.id}`);
    return selectedEntry;
  }
  
  async saveActingVideo(id: string, actingVideoLocation: string): Promise<VideoEntry | null> {
    this.log(`Saving acting video for entry ${id}`);
    
    let savedLocation = actingVideoLocation;
    
    // If it's a blob URL, fetch the blob and save it to IndexedDB
    if (actingVideoLocation.startsWith('blob:')) {
      try {
        const response = await fetch(actingVideoLocation);
        const blob = await response.blob();
        
        // Save the video blob to IndexedDB
        await videoStorage.saveVideo({
          id: `acting_${id}`,
          blob
        });
        
        // Use a reference to the video in IndexedDB
        savedLocation = `idb://acting_${id}`;
        this.log(`Saved acting video to IndexedDB with ID: acting_${id}`);
      } catch (error) {
        this.error('Failed to save acting video to IndexedDB:', error);
        throw error;
      }
    }
    
    return this.updateEntry(id, { acting_video_location: savedLocation });
  }
  
  updateEntry(id: string, update: Partial<VideoEntry>): VideoEntry | null {
    const entries = this.getAll();
    const index = entries.findIndex(entry => entry.id === id);
    
    if (index === -1) {
      this.warn(`Entry with id ${id} not found for update`);
      return null;
    }
    
    const updatedEntry = { ...entries[index], ...update };
    entries[index] = updatedEntry;
    
    this.save(entries);
    this.log(`Updated entry: ${id}`);
    return updatedEntry;
  }
  
  markAsSkipped(id: string): VideoEntry | null {
    return this.updateEntry(id, { skipped: true });
  }
  
  setApprovalStatus(id: string, approved: boolean): VideoEntry | null {
    this.log(`Setting approval status for entry ${id} to ${approved}`);
    return this.updateEntry(id, { admin_approved: approved });
  }
  
  async getVideoUrl(videoLocation: string): Promise<string> {
    if (videoLocation.startsWith('idb://')) {
      const videoId = videoLocation.substring(6); // Remove the 'idb://' prefix
      
      try {
        const blob = await videoStorage.getVideo(videoId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          this.log(`Created object URL for video ${videoId}: ${url}`);
          return url;
        } else {
          this.error(`Video not found in storage: ${videoId}`);
          return '';
        }
      } catch (error) {
        this.error(`Error getting video ${videoId}:`, error);
        return '';
      }
    }
    
    return videoLocation;
  }
  
  getAllEntries(): VideoEntry[] {
    return this.getAll();
  }
  
  async clearAllEntries(): Promise<void> {
    // Get all entries to find video IDs
    const entries = this.getAll();
    
    // Clear all videos from IndexedDB
    try {
      await videoStorage.clearAllVideos();
      this.log('Cleared all videos from storage');
    } catch (error) {
      this.error('Error clearing videos from storage:', error);
    }
    
    // Clear entries from localStorage
    this.save([]);
    this.log('Cleared all entries');
  }
  
  async deleteEntry(id: string): Promise<boolean> {
    const entries = this.getAll();
    const entry = entries.find(e => e.id === id);
    
    if (!entry) {
      this.warn(`Entry with id ${id} not found for deletion`);
      return false;
    }
    
    // Delete the original video if it's in IndexedDB
    if (entry.video_location.startsWith('idb://')) {
      const videoId = entry.video_location.substring(6);
      try {
        await videoStorage.deleteVideo(videoId);
        this.log(`Deleted video ${videoId} from storage`);
      } catch (error) {
        this.error(`Error deleting video ${videoId}:`, error);
      }
    }
    
    // Delete the acting video if it exists and is in IndexedDB
    if (entry.acting_video_location && entry.acting_video_location.startsWith('idb://')) {
      const actingVideoId = entry.acting_video_location.substring(6);
      try {
        await videoStorage.deleteVideo(actingVideoId);
        this.log(`Deleted acting video ${actingVideoId} from storage`);
      } catch (error) {
        this.error(`Error deleting acting video ${actingVideoId}:`, error);
      }
    }
    
    // Remove the entry from the list
    const updatedEntries = entries.filter(e => e.id !== id);
    this.save(updatedEntries);
    this.log(`Deleted entry: ${id}`);
    
    return true;
  }
  
  private log(...args: any[]): void {
    if (this.DEBUG) console.log('[VideoDB]', ...args);
  }
  
  private warn(...args: any[]): void {
    if (this.DEBUG) console.warn('[VideoDB]', ...args);
  }
  
  private error(...args: any[]): void {
    console.error('[VideoDB]', ...args);
  }
}

export const videoDB = new VideoDatabase();
