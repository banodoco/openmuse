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
      this.logger.log("Getting all entries from media table");
      
      // See if we're authenticated and log that
      const { data: { session } } = await supabase.auth.getSession();
      this.logger.log(`Auth check in getAllEntries: ${session?.user ? 'Authenticated as ' + session.user.id : 'Not authenticated'}`);
      
      // Log current user ID from the class instance
      this.logger.log(`Current user ID in instance: ${this.currentUserId || 'none'}`);
      
      // Query media table instead of video_entries
      const { data, error } = await supabase
        .from('media')
        .select('*, assets!asset_media(id, name, description, type, creator, primary_media_id)')
        .eq('type', 'video')
        .order('created_at', { ascending: false });
      
      if (error) {
        this.logger.error('Error getting entries from Supabase:', error);
        throw error;
      }
      
      this.logger.log(`Retrieved ${data?.length || 0} entries from Supabase`);
      
      // Transform the data to our VideoEntry type
      const entries: VideoEntry[] = data.map(media => {
        // Find associated asset (if any)
        const assets = media.assets as any[] || [];
        const asset = assets.length > 0 ? assets[0] : null;
        
        const entry: VideoEntry = {
          id: media.id,
          url: media.url,
          reviewer_name: media.creator || 'Unknown',
          skipped: false,
          created_at: media.created_at,
          admin_status: media.admin_status || 'Listed',
          user_status: media.user_status || null,
          user_id: media.user_id,
          metadata: {
            title: media.title,
            description: '',
            creator: 'self',
            classification: media.classification || 'art',
            loraName: asset?.name,
            loraDescription: asset?.description,
            assetId: asset?.id,
            isPrimary: asset?.primary_media_id === media.id
          }
        };
        
        return entry;
      });
      
      return entries;
    } catch (error) {
      this.logger.error('Error getting entries from Supabase:', error);
      return [];
    }
  }
  
  async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
    try {
      const { data, error } = await supabase
        .from('media')
        .update({
          title: update.metadata?.title,
          classification: update.metadata?.classification,
          creator: update.metadata?.creatorName || update.reviewer_name,
          admin_status: update.admin_status,
          user_status: update.user_status,
          description: update.metadata?.description
        })
        .eq('id', id)
        .select('*, assets!asset_media(id, name, description, type, creator, primary_media_id)')
        .single();
      
      if (error) {
        this.logger.error(`Error updating media ${id}:`, error);
        return null;
      }
      
      // If there's an asset ID in metadata, update the asset too
      if (update.metadata?.assetId) {
        const { error: assetError } = await supabase
          .from('assets')
          .update({
            name: update.metadata.loraName,
            description: update.metadata.loraDescription,
            creator: update.metadata.creatorName || update.reviewer_name
          })
          .eq('id', update.metadata.assetId);
        
        if (assetError) {
          this.logger.error(`Error updating asset ${update.metadata.assetId}:`, assetError);
        }
      }
      
      // Find associated asset (if any)
      const assets = data.assets as any[] || [];
      const asset = assets.length > 0 ? assets[0] : null;
      
      // Construct the updated VideoEntry object
      const updatedEntry: VideoEntry = {
        id: data.id,
        url: data.url,
        reviewer_name: data.creator || 'Unknown',
        skipped: update.skipped || false,
        created_at: data.created_at,
        admin_status: data.admin_status || 'Listed',
        user_status: data.user_status || null,
        user_id: data.user_id,
        metadata: {
          title: data.title,
          description: update.metadata?.description || '',
          creator: update.metadata?.creator || 'self',
          classification: data.classification || 'art',
          loraName: asset?.name || update.metadata?.loraName,
          loraDescription: asset?.description || update.metadata?.loraDescription,
          assetId: asset?.id || update.metadata?.assetId,
          isPrimary: asset?.primary_media_id === data.id || update.metadata?.isPrimary || false
        }
      };
      
      return updatedEntry;
    } catch (error) {
      this.logger.error(`Error updating entry ${id}:`, error);
      return null;
    }
  }
  
  async markAsSkipped(id: string): Promise<VideoEntry | null> {
    // Implement skipped status differently since video_entries is gone
    // Just pass through to updateEntry for now
    return this.updateEntry(id, { skipped: true });
  }
  
  async setApprovalStatus(id: string, status: string): Promise<VideoEntry | null> {
    this.logger.log(`Setting admin status for entry ${id} to ${status}`);
    
    if (this.currentUserId) {
      const isAdmin = await checkIsAdmin(this.currentUserId);
      if (!isAdmin) {
        this.logger.error('Non-admin user attempted to set admin status');
        throw new Error('Permission denied: Only admins can change admin status');
      }
    } else {
      this.logger.error('Unauthenticated user attempted to set admin status');
      throw new Error('Authentication required to change admin status');
    }
    
    // Pass through to updateEntry to update admin_status
    return this.updateEntry(id, { admin_status: status });
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
      
      // First check if this is a primary media for any asset
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('id')
        .eq('primary_media_id', id);
      
      if (!assetError && assetData && assetData.length > 0) {
        // This is a primary media, update the asset
        for (const asset of assetData) {
          // Find another media for this asset to make primary
          const { data: otherMediaData, error: otherMediaError } = await supabase
            .from('asset_media')
            .select('media_id')
            .eq('asset_id', asset.id)
            .neq('media_id', id)
            .limit(1);
          
          if (!otherMediaError && otherMediaData && otherMediaData.length > 0) {
            // Update asset with new primary media
            await supabase
              .from('assets')
              .update({ primary_media_id: otherMediaData[0].media_id })
              .eq('id', asset.id);
          } else {
            // No other media, set primary_media_id to null
            await supabase
              .from('assets')
              .update({ primary_media_id: null })
              .eq('id', asset.id);
          }
        }
      }
      
      // Remove asset_media relationships
      await supabase
        .from('asset_media')
        .delete()
        .eq('media_id', id);
      
      // Get the media entry to find the URL
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('url')
        .eq('id', id)
        .single();
      
      if (!mediaError && mediaData) {
        // Delete from storage if it's a Supabase storage URL
        if (mediaData.url && mediaData.url.includes('supabase.co')) {
          try {
            const videoFileName = mediaData.url.split('/').pop();
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
      }
      
      // Delete the media entry
      const { error: deleteError } = await supabase
        .from('media')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        this.logger.error(`Error deleting media ${id}:`, deleteError);
        return false;
      }
      
      this.logger.log(`Deleted media entry: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting entry ${id}:`, error);
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
      
      // Delete all asset_media relationships first
      const { error: deleteRelationError } = await supabase
        .from('asset_media')
        .delete()
        .neq('id', 'placeholder');
      
      if (deleteRelationError) {
        this.logger.error('Error deleting asset_media relationships:', deleteRelationError);
      }
      
      // Update all assets to remove primary_media_id
      const { error: updateAssetsError } = await supabase
        .from('assets')
        .update({ primary_media_id: null })
        .neq('id', 'placeholder');
      
      if (updateAssetsError) {
        this.logger.error('Error updating assets:', updateAssetsError);
      }
      
      // Delete all assets
      const { error: deleteAssetsError } = await supabase
        .from('assets')
        .delete()
        .neq('id', 'placeholder');
      
      if (deleteAssetsError) {
        this.logger.error('Error deleting assets:', deleteAssetsError);
      }
      
      // Delete all media
      const { error: deleteMediaError } = await supabase
        .from('media')
        .delete()
        .eq('type', 'video');
      
      if (deleteMediaError) {
        this.logger.error('Error deleting media:', deleteMediaError);
      }
      
      this.logger.log('Cleared all entries');
    } catch (error) {
      this.logger.error('Error clearing entries from Supabase:', error);
    }
  }
}

export const videoEntryService = new VideoEntryService();
