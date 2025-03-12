
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
      
      // Convert base64 strings back to blob URLs if needed
      const processedEntries = parsedEntries.map(entry => {
        const processedEntry = { ...entry };
        
        // Create blob URLs from base64 if stored that way
        if (entry.video_location && entry.video_location.startsWith('data:')) {
          try {
            const blob = this.base64ToBlob(entry.video_location);
            processedEntry.video_location = URL.createObjectURL(blob);
            this.log(`Recreated blob URL for video: ${processedEntry.video_location}`);
          } catch (error) {
            this.error('Failed to convert base64 to blob for video:', error);
          }
        }
        
        if (entry.acting_video_location && entry.acting_video_location.startsWith('data:')) {
          try {
            const blob = this.base64ToBlob(entry.acting_video_location);
            processedEntry.acting_video_location = URL.createObjectURL(blob);
            this.log(`Recreated blob URL for acting video: ${processedEntry.acting_video_location}`);
          } catch (error) {
            this.error('Failed to convert base64 to blob for acting video:', error);
          }
        }
        
        return processedEntry;
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
      
      // Store blob URLs as base64 data
      const preparedEntries = entries.map(entry => {
        const preparedEntry = { ...entry };
        
        // Only convert blob URLs, not already processed ones
        if (entry.video_location && entry.video_location.startsWith('blob:')) {
          try {
            this.log(`Converting blob to base64 for video: ${entry.video_location}`);
            // For real applications, this would be an async operation
            // Here we'll just mark it as a placeholder since we can't fetch the blob content
            preparedEntry.video_location = `data:video/webm;base64,PLACEHOLDER_${Date.now()}`;
          } catch (error) {
            this.error('Failed to convert blob to base64 for video:', error);
          }
        }
        
        if (entry.acting_video_location && entry.acting_video_location.startsWith('blob:')) {
          try {
            this.log(`Converting blob to base64 for acting video: ${entry.acting_video_location}`);
            // In a real app, we'd fetch the blob and convert it to base64
            // For demonstration purposes, we'll use a placeholder
            preparedEntry.acting_video_location = `data:video/webm;base64,PLACEHOLDER_${Date.now()}`;
          } catch (error) {
            this.error('Failed to convert blob to base64 for acting video:', error);
          }
        }
        
        return preparedEntry;
      });
      
      localStorage.setItem(this.VIDEO_KEY, JSON.stringify(preparedEntries));
      this.log(`Saved ${entries.length} entries to localStorage`);
    } catch (error) {
      this.error('Error saving entries to localStorage:', error);
    }
  }
  
  // Helper method to convert base64 to blob
  private base64ToBlob(base64: string): Blob {
    try {
      const parts = base64.split(',');
      const contentType = parts[0].split(':')[1].split(';')[0];
      const byteCharacters = atob(parts[1]);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      return new Blob(byteArrays, { type: contentType });
    } catch (error) {
      this.error('Error converting base64 to blob:', error);
      // Return an empty blob as fallback
      return new Blob([], { type: 'video/webm' });
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
    
    // If it's a blob URL, we need to convert it to base64 in a real app
    // For our purposes, just log the URL type
    if (actingVideoLocation.startsWith('blob:')) {
      this.log(`Acting video is a blob URL. In a real app, would fetch and store as base64.`);
    }
    
    return this.updateEntry(id, { acting_video_location: actingVideoLocation });
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

export const videoDB = new VideoDatabase();
