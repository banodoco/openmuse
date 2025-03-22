
import { supabase } from './supabase';
import { VideoEntry } from './types';
import { remoteStorage } from './remoteStorage';
import { videoStorage } from './storage';
import { checkIsAdmin } from './auth';

class SupabaseVideoDatabase {
  private readonly DEBUG = true;
  private currentUserId: string | null = null;
  
  setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
    this.log(`Current user ID set to: ${userId || 'none'}`);
  }
  
  async getAllEntries(): Promise<VideoEntry[]> {
    try {
      this.log("Getting all entries from Supabase");
      
      // See if we're authenticated and log that
      const { data: { session } } = await supabase.auth.getSession();
      this.log(`Auth check in getAllEntries: ${session?.user ? 'Authenticated as ' + session.user.id : 'Not authenticated'}`);
      
      // Log current user ID from the class instance
      this.log(`Current user ID in instance: ${this.currentUserId || 'none'}`);
      
      // Build and log the query we're about to make
      this.log("Executing Supabase query for video_entries");
      
      const { data, error } = await supabase
        .from('video_entries')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        this.error('Error getting entries from Supabase:', error);
        throw error;
      }
      
      this.log(`Retrieved ${data?.length || 0} entries from Supabase`);
      if (data && data.length > 0) {
        this.log(`First entry: ${JSON.stringify(data[0])}`);
      }
      
      return data as VideoEntry[] || [];
    } catch (error) {
      this.error('Error getting entries from Supabase:', error);
      return [];
    }
  }
  
  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    if (!this.currentUserId) {
      this.warn('User not authenticated, proceeding without user_id');
    }
    
    let videoLocation = entry.video_location;
    
    if (entry.video_location.startsWith('blob:')) {
      try {
        const response = await fetch(entry.video_location);
        const blob = await response.blob();
        
        const videoFile = {
          id: `video_${Date.now()}`,
          blob
        };
        
        videoLocation = await remoteStorage.uploadVideo(videoFile);
        this.log(`Saved video to Supabase Storage: ${videoLocation}`);
      } catch (error) {
        this.error('Failed to save video to Supabase Storage:', error);
        throw error;
      }
    }
    
    try {
      const { data, error } = await supabase
        .from('video_entries')
        .insert({
          reviewer_name: entry.reviewer_name,
          video_location: videoLocation,
          skipped: entry.skipped || false,
          user_id: this.currentUserId
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
  
  async getRandomPendingEntry(): Promise<VideoEntry | null> {
    try {
      let userOwnVideos = null;
      if (this.currentUserId) {
        const { data: ownVideos, error: ownVideosError } = await supabase
          .from('video_entries')
          .select('*')
          .is('acting_video_location', null)
          .eq('skipped', false)
          .eq('user_id', this.currentUserId)
          .order('created_at', { ascending: false });
        
        if (ownVideosError) {
          this.error('Error fetching user\'s own videos:', ownVideosError);
        } else if (ownVideos && ownVideos.length > 0) {
          userOwnVideos = ownVideos;
          this.log(`Found ${ownVideos.length} of user's own pending videos`);
        }
      }
      
      if (userOwnVideos && userOwnVideos.length > 0) {
        const randomIndex = Math.floor(Math.random() * userOwnVideos.length);
        const selectedEntry = userOwnVideos[randomIndex] as VideoEntry;
        this.log(`Selected random video from user's own uploads: ${selectedEntry.id}`);
        return selectedEntry;
      }
      
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
  
  async saveActingVideo(id: string, actingVideoLocation: string): Promise<VideoEntry | null> {
    this.log(`Saving acting video for entry ${id}`);
    
    if (!this.currentUserId) {
      this.warn('User not authenticated when saving acting video');
    }
    
    let savedLocation = actingVideoLocation;
    
    if (actingVideoLocation.startsWith('blob:')) {
      try {
        const response = await fetch(actingVideoLocation);
        const blob = await response.blob();
        const fileName = `acting_${id}_${Date.now()}.webm`;
        
        const { data: storageData, error: storageError } = await supabase.storage
          .from('videos')
          .upload(fileName, blob, {
            contentType: 'video/webm',
            upsert: true
          });
        
        if (storageError) {
          throw storageError;
        }
        
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
        .update({
          acting_video_location: savedLocation,
          user_id: this.currentUserId || undefined
        })
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
  
  async markAsSkipped(id: string): Promise<VideoEntry | null> {
    return this.updateEntry(id, { skipped: true });
  }
  
  async setApprovalStatus(id: string, approved: boolean): Promise<VideoEntry | null> {
    this.log(`Setting approval status for entry ${id} to ${approved}`);
    
    if (this.currentUserId) {
      const isAdmin = await checkIsAdmin(this.currentUserId);
      if (!isAdmin) {
        this.error('Non-admin user attempted to set approval status');
        throw new Error('Permission denied: Only admins can change approval status');
      }
    } else {
      this.error('Unauthenticated user attempted to set approval status');
      throw new Error('Authentication required to change approval status');
    }
    
    return this.updateEntry(id, { admin_approved: approved });
  }
  
  async deleteEntry(id: string): Promise<boolean> {
    try {
      if (this.currentUserId) {
        const isAdmin = await checkIsAdmin(this.currentUserId);
        if (!isAdmin) {
          this.error('Non-admin user attempted to delete entry');
          throw new Error('Permission denied: Only admins can delete entries');
        }
      } else {
        this.error('Unauthenticated user attempted to delete entry');
        throw new Error('Authentication required to delete entries');
      }
      
      const { data: entry, error: fetchError } = await supabase
        .from('video_entries')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (entry.video_location && entry.video_location.includes('supabase.co')) {
        try {
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
  
  async getVideoUrl(videoLocation: string): Promise<string> {
    if (videoLocation.includes('supabase.co')) {
      return videoLocation;
    }
    
    if (videoLocation.startsWith('idb://')) {
      const videoId = videoLocation.substring(6);
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
      return videoLocation;
    }
    
    return videoLocation;
  }
  
  async clearAllEntries(): Promise<void> {
    try {
      if (this.currentUserId) {
        const isAdmin = await checkIsAdmin(this.currentUserId);
        if (!isAdmin) {
          this.error('Non-admin user attempted to clear all entries');
          throw new Error('Permission denied: Only admins can clear all entries');
        }
      } else {
        this.error('Unauthenticated user attempted to clear all entries');
        throw new Error('Authentication required to clear all entries');
      }
      
      const { data: entries, error: fetchError } = await supabase
        .from('video_entries')
        .select('*');
      
      if (fetchError) {
        throw fetchError;
      }
      
      for (const entry of entries) {
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
      
      const { error: deleteError } = await supabase
        .from('video_entries')
        .delete()
        .neq('id', 'placeholder');
      
      if (deleteError) {
        throw deleteError;
      }
      
      this.log('Cleared all entries');
    } catch (error) {
      this.error('Error clearing entries from Supabase:', error);
    }
  }
  
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
