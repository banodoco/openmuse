
import { VideoEntry } from './types';

// For simplicity, we'll use localStorage as our database
// In a real application, you would use a proper database
class VideoDatabase {
  private readonly VIDEO_KEY = 'video_response_entries';
  
  private getAll(): VideoEntry[] {
    const entries = localStorage.getItem(this.VIDEO_KEY);
    return entries ? JSON.parse(entries) : [];
  }
  
  private save(entries: VideoEntry[]): void {
    localStorage.setItem(this.VIDEO_KEY, JSON.stringify(entries));
  }
  
  addEntry(entry: Omit<VideoEntry, 'id' | 'created_at'>): VideoEntry {
    const entries = this.getAll();
    const newEntry: VideoEntry = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    
    this.save([...entries, newEntry]);
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
    
    if (index === -1) return null;
    
    const updatedEntry = { ...entries[index], ...update };
    entries[index] = updatedEntry;
    
    this.save(entries);
    return updatedEntry;
  }
  
  markAsSkipped(id: string): VideoEntry | null {
    return this.updateEntry(id, { skipped: true });
  }
  
  saveActingVideo(id: string, actingVideoLocation: string): VideoEntry | null {
    return this.updateEntry(id, { acting_video_location: actingVideoLocation });
  }
  
  getAllEntries(): VideoEntry[] {
    return this.getAll();
  }
  
  clearAllEntries(): void {
    this.save([]);
  }
}

export const videoDB = new VideoDatabase();
