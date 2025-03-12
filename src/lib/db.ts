import { VideoEntry } from './types';

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
    
    let videoLocation = entry.video_location;
    if (entry.video_location.startsWith('blob:')) {
      try {
        const response = await fetch(entry.video_location);
        const blob = await response.blob();
        videoLocation = await this.blobToDataUrl(blob);
        this.log('Successfully converted blob to data URL');
      } catch (error) {
        this.error('Failed to convert blob to data URL:', error);
        throw error;
      }
    }
    
    const newEntry: VideoEntry = {
      ...entry,
      video_location: videoLocation,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      admin_approved: false
    };
    
    this.save([...entries, newEntry]);
    this.log(`Added new entry: ${newEntry.id}`);
    return newEntry;
  }
  
  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
    if (actingVideoLocation.startsWith('blob:')) {
      try {
        const response = await fetch(actingVideoLocation);
        const blob = await response.blob();
        savedLocation = await this.blobToDataUrl(blob);
        this.log('Successfully converted acting video blob to data URL');
      } catch (error) {
        this.error('Failed to convert acting video blob to data URL:', error);
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
  
  getAllEntries(): VideoEntry[] {
    return this.getAll();
  }
  
  clearAllEntries(): void {
    this.save([]);
    this.log('Cleared all entries');
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
