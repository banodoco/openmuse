import { supabase } from './supabase';
import { VideoEntry } from './types';
import { remoteStorage } from './remoteStorage';
import { videoStorage } from './storage';

class SupabaseVideoDatabase {
  private readonly DEBUG = true;
  
  // Get all video entries
  async getAllEntries(): Promise<VideoEntry[]> {
    try {
      const { data, error } = await supabase
        .from('video_entries')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      this.log(`Retrieved ${data.length} entries from Supabase`);
      return data as VideoEntry[];
    } catch (error) {
      this.error('Error getting entries from Supabase:', error);
      return [];
    }
  }
  
  // Add a new video entry
  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    let videoLocation = entry.video_location;
    
    // If it's a blob URL, fetch the blob and upload it
    if (entry.video_location.startsWith('blob:')) {
      try {
        const response = await fetch(entry.video_location);
        const blob = await response.blob();
        
        // Create a VideoFile object
        const videoFile = {
          id: `video_${Date.now()}`,
          blob
        };
        
        // Upload using remoteStorage
        videoLocation = await remoteStorage.uploadVideo(videoFile);
        this.log(`Saved video to Supabase Storage: ${videoLocation}`);
      } catch (error) {
        this.error('Failed to save video to Supabase Storage:', error);
        throw error;
      }
    }
    
    try {
      // Insert into database
      const { data, error } = await supabase
        .from('video_entries')
        .insert({
          reviewer_name: entry.reviewer_name,
          video_location: videoLocation,
          skipped: entry.skipped || false
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.log(`Added new entry: ${data.id}`);
      return data as VideoEntry;
    } catch (error) {
      this.error('Error adding entry to Supabase:', error);
      throw error;
    }
  }
  
  // Get a random pending entry
  async getRandomPendingEntry(): Promise<VideoEntry | null> {
    try {
      const { data, error } = await supabase
        .from('video_entries')
        .select('*')
        .is('acting_video_location', null)
        .eq('skipped', false)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      if (data.length === 0) {
        this.log('No pending entries found');
        return null;
      }
      
      const randomIndex = Math.floor(Math.random() * data.length);
      const selectedEntry = data[randomIndex] as VideoEntry;
      this.log(`Selected random pending entry: ${selectedEntry.id}`);
      return selectedEntry;
    } catch (error) {
      this.error('Error getting random entry from Supabase:', error);
      return null;
    }
  }
  
  // Save an acting video
  async saveActingVideo(id: string, actingVideoLocation: string): Promise<VideoEntry | null> {
    this.log(`Saving acting video for entry ${id}`);
    
    let savedLocation = actingVideoLocation;
    
    // If it's a blob URL, fetch the blob and save it
    if (actingVideoLocation.startsWith('blob:')) {
      try {
        const response = await fetch(actingVideoLocation);
        const blob = await response.blob();
        const fileName = `acting_${id}_${Date.now()}.webm`;
        
        // Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from('videos')
          .upload(fileName, blob, {
            contentType: 'video/webm',
            upsert: true
          });
        
        if (storageError) {
          throw storageError;
        }
        
        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('videos')
          .getPublicUrl(fileName);
        
        savedLocation = urlData.publicUrl;
        this.log(`Saved acting video to Supabase Storage: ${savedLocation}`);
      } catch (error) {
        this.error('Failed to save acting video to Supabase Storage:', error);
        throw error;
      }
    }
    
    try {
      const { data, error } = await supabase
        .from('video_entries')
        .update({ acting_video_location: savedLocation })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.log(`Updated entry with acting video: ${id}`);
      return data as VideoEntry;
    } catch (error) {
      this.error('Error updating entry in Supabase:', error);
      return null;
    }
  }
  
  // Update an entry
  async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
    try {
      const { data, error } = await supabase
        .from('video_entries')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.log(`Updated entry: ${id}`);
      return data as VideoEntry;
    } catch (error) {
      this.error(`Error updating entry ${id} in Supabase:`, error);
      return null;
    }
  }
  
  // Mark an entry as skipped
  async markAsSkipped(id: string): Promise<VideoEntry | null> {
    return this.updateEntry(id, { skipped: true });
  }
  
  // Set approval status
  async setApprovalStatus(id: string, approved: boolean): Promise<VideoEntry | null> {
    this.log(`Setting approval status for entry ${id} to ${approved}`);
    return this.updateEntry(id, { admin_approved: approved });
  }
  
  // Delete an entry
  async deleteEntry(id: string): Promise<boolean> {
    try {
      // Get the entry first to retrieve file locations
      const { data: entry, error: fetchError } = await supabase
        .from('video_entries')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      // Delete videos from storage if they're in Supabase Storage
      if (entry.video_location && entry.video_location.includes('supabase.co')) {
        try {
          // Extract the file name from the URL
          const videoFileName = entry.video_location.split('/').pop();
          if (videoFileName) {
            await supabase.storage
              .from('videos')
              .remove([videoFileName]);
            this.log(`Deleted video ${videoFileName} from Supabase Storage`);
          }
        } catch (storageError) {
          this.error(`Error deleting video from Supabase Storage:`, storageError);
        }
      }
      
      if (entry.acting_video_location && entry.acting_video_location.includes('supabase.co')) {
        try {
          // Extract the file name from the URL
          const actingFileName = entry.acting_video_location.split('/').pop();
          if (actingFileName) {
            await supabase.storage
              .from('videos')
              .remove([actingFileName]);
            this.log(`Deleted acting video ${actingFileName} from Supabase Storage`);
          }
        } catch (storageError) {
          this.error(`Error deleting acting video from Supabase Storage:`, storageError);
        }
      }
      
      // Delete the entry
      const { error: deleteError } = await supabase
        .from('video_entries')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        throw deleteError;
      }
      
      this.log(`Deleted entry: ${id}`);
      return true;
    } catch (error) {
      this.error(`Error deleting entry ${id} from Supabase:`, error);
      return false;
    }
  }
  
  // Get a video URL
  async getVideoUrl(videoLocation: string): Promise<string> {
    // If it's already a Supabase URL, return it directly
    if (videoLocation.includes('supabase.co')) {
      return videoLocation;
    }
    
    // For other types of storage, use the existing methods
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
    } else if (videoLocation.startsWith('http://') || videoLocation.startsWith('https://')) {
      // Return remote URLs as-is
      return videoLocation;
    }
    
    return videoLocation;
  }
  
  // Clear all entries
  async clearAllEntries(): Promise<void> {
    try {
      // Get all entries to find video IDs
      const { data: entries, error: fetchError } = await supabase
        .from('video_entries')
        .select('*');
      
      if (fetchError) {
        throw fetchError;
      }
      
      // Delete all videos from Supabase Storage
      for (const entry of entries) {
        // Original video
        if (entry.video_location && entry.video_location.includes('supabase.co')) {
          try {
            const videoFileName = entry.video_location.split('/').pop();
            if (videoFileName) {
              await supabase.storage
                .from('videos')
                .remove([videoFileName]);
            }
          } catch (storageError) {
            this.error(`Error deleting video from Supabase Storage:`, storageError);
          }
        }
        
        // Acting video
        if (entry.acting_video_location && entry.acting_video_location.includes('supabase.co')) {
          try {
            const actingFileName = entry.acting_video_location.split('/').pop();
            if (actingFileName) {
              await supabase.storage
                .from('videos')
                .remove([actingFileName]);
            }
          } catch (storageError) {
            this.error(`Error deleting acting video from Supabase Storage:`, storageError);
          }
        }
      }
      
      // Delete all entries
      const { error: deleteError } = await supabase
        .from('video_entries')
        .delete()
        .neq('id', 'placeholder'); // Delete all
      
      if (deleteError) {
        throw deleteError;
      }
      
      this.log('Cleared all entries');
    } catch (error) {
      this.error('Error clearing entries from Supabase:', error);
    }
  }
  
  // Utility methods for logging
  private log(...args: any[]): void {
    if (this.DEBUG) console.log('[SupabaseDB]', ...args);
  }

  private warn(...args: any[]): void {
    if (this.DEBUG) console.warn('[SupabaseDB]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[SupabaseDB]', ...args);
  }
}

export const supabaseDB = new SupabaseVideoDatabase();
