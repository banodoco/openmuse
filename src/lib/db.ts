
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
      
      this.log(`Retrieved ${parsedEntries.length} entries from localStorage`);
      return parsedEntries;
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
  
  addEntry(entry: Omit<VideoEntry, 'id' | 'created_at'>): VideoEntry {
    const entries = this.getAll();
    const newEntry: VideoEntry = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    
    this.save([...entries, newEntry]);
    this.log(`Added new entry: ${newEntry.id}, video location: ${newEntry.video_location}`);
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
  
  saveActingVideo(id: string, actingVideoLocation: string): VideoEntry | null {
    this.log(`Saving acting video for entry ${id}: ${actingVideoLocation}`);
    return this.updateEntry(id, { acting_video_location: actingVideoLocation });
  }
  
  getAllEntries(): VideoEntry[] {
    const entries = this.getAll();
    this.log(`Retrieved all ${entries.length} entries`);
    return entries;
  }
  
  clearAllEntries(): void {
    this.save([]);
    this.log('Cleared all entries');
  }
  
  // Enhanced logging methods for better debugging
  private log(...args: any[]): void {
    if (this.DEBUG) console.log(...args);
  }
  
  private warn(...args: any[]): void {
    if (this.DEBUG) console.warn(...args);
  }
  
  private error(...args: any[]): void {
    console.error(...args); // Always log errors
  }
}

export const videoDB = new VideoDatabase();
