
import { VideoEntry } from './types';

// For simplicity, we'll use localStorage as our database
// In a real application, you would use a proper database
class VideoDatabase {
  private readonly VIDEO_KEY = 'video_response_entries';
  
  private getAll(): VideoEntry[] {
    try {
      const entries = localStorage.getItem(this.VIDEO_KEY);
      if (!entries) return [];
      
      const parsedEntries = JSON.parse(entries);
      console.log(`Retrieved ${parsedEntries.length} entries from localStorage`);
      return Array.isArray(parsedEntries) ? parsedEntries : [];
    } catch (error) {
      console.error('Error getting entries from localStorage:', error);
      return [];
    }
  }
  
  private save(entries: VideoEntry[]): void {
    try {
      localStorage.setItem(this.VIDEO_KEY, JSON.stringify(entries));
      console.log(`Saved ${entries.length} entries to localStorage`);
    } catch (error) {
      console.error('Error saving entries to localStorage:', error);
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
    console.log('Added new entry:', newEntry.id);
    return newEntry;
  }
  
  getRandomPendingEntry(): VideoEntry | null {
    const entries = this.getAll();
    const pendingEntries = entries.filter(
      entry => !entry.acting_video_location && !entry.skipped
    );
    
    if (pendingEntries.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * pendingEntries.length);
    return pendingEntries[randomIndex];
  }
  
  updateEntry(id: string, update: Partial<VideoEntry>): VideoEntry | null {
    const entries = this.getAll();
    const index = entries.findIndex(entry => entry.id === id);
    
    if (index === -1) {
      console.warn(`Entry with id ${id} not found for update`);
      return null;
    }
    
    const updatedEntry = { ...entries[index], ...update };
    entries[index] = updatedEntry;
    
    this.save(entries);
    console.log(`Updated entry: ${id}`);
    return updatedEntry;
  }
  
  markAsSkipped(id: string): VideoEntry | null {
    return this.updateEntry(id, { skipped: true });
  }
  
  saveActingVideo(id: string, actingVideoLocation: string): VideoEntry | null {
    return this.updateEntry(id, { acting_video_location: actingVideoLocation });
  }
  
  getAllEntries(): VideoEntry[] {
    const entries = this.getAll();
    console.log(`Retrieved all ${entries.length} entries`);
    return entries;
  }
  
  clearAllEntries(): void {
    this.save([]);
    console.log('Cleared all entries');
  }
}

export const videoDB = new VideoDatabase();
