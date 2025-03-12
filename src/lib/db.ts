
import { VideoEntry } from './types';

// For simplicity, we'll use localStorage as our database
// In a real application, you would use a proper database
class VideoDatabase {
  private readonly VIDEO_KEY = 'video_response_entries';
  private readonly DEBUG = true; // Enable verbose logging
  
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
      
      // Process the entries but don't try to convert base64 to blob URLs here
      // as they will be short-lived and cause issues
      const processedEntries = parsedEntries.map(entry => {
        return { ...entry };
      });
      
      this.log(`Retrieved ${processedEntries.length} entries from localStorage (${processedEntries.filter(e => e.acting_video_location).length} with responses)`);
      return processedEntries;
    } catch (error) {
      this.error('Error getting entries from localStorage:', error);
      return [];
    }
  }
  
  private save(entries: VideoEntry[]): void {
    try {
      if (!Array.isArray(entries)) {
        this.error('Attempted to save non-array data to localStorage');
        return;
      }
      
      localStorage.setItem(this.VIDEO_KEY, JSON.stringify(entries));
      this.log(`Saved ${entries.length} entries to localStorage`);
    } catch (error) {
      this.error('Error saving entries to localStorage:', error);
    }
  }
  
  // Helper method to safely fetch a blob and convert to base64
  private async blobUrlToBase64(blobUrl: string): Promise<string> {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      this.error('Error converting blob URL to base64:', error);
      throw error;
    }
  }
  
  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at'>): Promise<VideoEntry> {
    const entries = this.getAll();
    
    let videoLocation = entry.video_location;
    
    // If it's a blob URL, convert to base64 for persistence
    if (entry.video_location.startsWith('blob:')) {
      try {
        this.log(`Converting blob to base64 for video: ${entry.video_location}`);
        videoLocation = await this.blobUrlToBase64(entry.video_location);
        this.log('Successfully converted blob to base64');
      } catch (error) {
        this.error('Failed to convert blob to base64, storing original URL:', error);
      }
    }
    
    const newEntry: VideoEntry = {
      ...entry,
      video_location: videoLocation,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    
    this.save([...entries, newEntry]);
    this.log(`Added new entry: ${newEntry.id}, video location: ${newEntry.video_location.substring(0, 50)}...`);
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
  
  async saveActingVideo(id: string, actingVideoLocation: string): Promise<VideoEntry | null> {
    this.log(`Saving acting video for entry ${id}: ${actingVideoLocation.substring(0, 50)}...`);
    
    let savedLocation = actingVideoLocation;
    
    // If it's a blob URL, convert to base64 for persistence
    if (actingVideoLocation.startsWith('blob:')) {
      try {
        this.log('Converting blob URL to base64 for storage');
        savedLocation = await this.blobUrlToBase64(actingVideoLocation);
        this.log('Successfully converted blob to base64');
      } catch (error) {
        this.error('Failed to convert blob to base64, storing original URL:', error);
      }
    }
    
    return this.updateEntry(id, { acting_video_location: savedLocation });
  }
  
  getAllEntries(): VideoEntry[] {
    const entries = this.getAll();
    this.log(`Retrieved all ${entries.length} entries (${entries.filter(e => e.acting_video_location).length} with responses)`);
    return entries;
  }
  
  clearAllEntries(): void {
    this.save([]);
    this.log('Cleared all entries');
  }
  
  // Enhanced logging methods for better debugging
  private log(...args: any[]): void {
    if (this.DEBUG) console.log('[VideoDB]', ...args);
  }
  
  private warn(...args: any[]): void {
    if (this.DEBUG) console.warn('[VideoDB]', ...args);
  }
  
  private error(...args: any[]): void {
    console.error('[VideoDB]', ...args); // Always log errors
  }
}

// Create a singleton instance
export const videoDB = new VideoDatabase();
