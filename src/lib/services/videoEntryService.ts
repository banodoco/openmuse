
import { supabase } from '../supabase';
import { VideoEntry } from '../types';
import { Logger } from '../logger';
import { checkIsAdmin } from '../auth';

export class VideoEntryService {
  private readonly logger = new Logger('VideoEntryService');
  private currentUserId: string | null = null;
  
  setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
    this.logger.log(`Current user ID set to: ${userId || 'none'}`);
  }
  
  async getAllEntries(): Promise<VideoEntry[]> {
    try {
      this.logger.log("Getting all entries from Supabase");
      
      // See if we're authenticated and log that
      const { data: { session } } = await supabase.auth.getSession();
      this.logger.log(`Auth check in getAllEntries: ${session?.user ? 'Authenticated as ' + session.user.id : 'Not authenticated'}`);
      
      // Log current user ID from the class instance
      this.logger.log(`Current user ID in instance: ${this.currentUserId || 'none'}`);
      
      // Build and log the query we're about to make - fetch ALL videos regardless of user_id
      this.logger.log("Executing Supabase query for all video_entries");
      
      const { data, error } = await supabase
        .from('video_entries')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        this.logger.error('Error getting entries from Supabase:', error);
        throw error;
      }
      
      this.logger.log(`Retrieved ${data?.length || 0} entries from Supabase`);
      if (data && data.length > 0) {
        this.logger.log(`First entry: ${JSON.stringify(data[0])}`);
      }
      
      // Convert the data to our VideoEntry type
      return (data || []).map(entry => ({
        ...entry,
        metadata: entry.metadata as unknown as VideoEntry['metadata']
      })) as VideoEntry[];
    } catch (error) {
      this.logger.error('Error getting entries from Supabase:', error);
      return [];
    }
  }
  
  async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
    try {
      // Convert our VideoEntry metadata to Json for Supabase
      const supabaseUpdate = {
        ...update,
        metadata: update.metadata as any
      };
      
      const { data, error } = await supabase
        .from('video_entries')
        .update(supabaseUpdate)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.logger.log(`Updated entry: ${id}`);
      
      // Convert back to our VideoEntry type
      return {
        ...data,
        metadata: data.metadata as unknown as VideoEntry['metadata']
      } as VideoEntry;
    } catch (error) {
      this.logger.error(`Error updating entry ${id} in Supabase:`, error);
      return null;
    }
  }
  
  async markAsSkipped(id: string): Promise<VideoEntry | null> {
    return this.updateEntry(id, { skipped: true });
  }
  
  async setApprovalStatus(id: string, approved: boolean): Promise<VideoEntry | null> {
    this.logger.log(`Setting approval status for entry ${id} to ${approved}`);
    
    if (this.currentUserId) {
      const isAdmin = await checkIsAdmin(this.currentUserId);
      if (!isAdmin) {
        this.logger.error('Non-admin user attempted to set approval status');
        throw new Error('Permission denied: Only admins can change approval status');
      }
    } else {
      this.logger.error('Unauthenticated user attempted to set approval status');
      throw new Error('Authentication required to change approval status');
    }
    
    return this.updateEntry(id, { admin_approved: approved });
  }
  
  async deleteEntry(id: string): Promise<boolean> {
    try {
      if (this.currentUserId) {
        const isAdmin = await checkIsAdmin(this.currentUserId);
        if (!isAdmin) {
          this.logger.error('Non-admin user attempted to delete entry');
          throw new Error('Permission denied: Only admins can delete entries');
        }
      } else {
        this.logger.error('Unauthenticated user attempted to delete entry');
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
            this.logger.log(`Deleted video ${videoFileName} from Supabase Storage`);
          }
        } catch (storageError) {
          this.logger.error(`Error deleting video from Supabase Storage:`, storageError);
        }
      }
      
      const { error: deleteError } = await supabase
        .from('video_entries')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        throw deleteError;
      }
      
      this.logger.log(`Deleted entry: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting entry ${id} from Supabase:`, error);
      return false;
    }
  }
  
  async clearAllEntries(): Promise<void> {
    try {
      if (this.currentUserId) {
        const isAdmin = await checkIsAdmin(this.currentUserId);
        if (!isAdmin) {
          this.logger.error('Non-admin user attempted to clear all entries');
          throw new Error('Permission denied: Only admins can clear all entries');
        }
      } else {
        this.logger.error('Unauthenticated user attempted to clear all entries');
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
            this.logger.error(`Error deleting video from Supabase Storage:`, storageError);
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
      
      this.logger.log('Cleared all entries');
    } catch (error) {
      this.logger.error('Error clearing entries from Supabase:', error);
    }
  }
}

export const videoEntryService = new VideoEntryService();
