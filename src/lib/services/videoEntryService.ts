import { supabase } from '../supabase';
import { VideoEntry, AdminStatus } from '../types';
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
        .select('*')
        .eq('type', 'video')
        .order('created_at', { ascending: false });
      
      if (error) {
        this.logger.error('Error getting entries from Supabase:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      this.logger.log(`Retrieved ${data?.length || 0} entries from Supabase`);
      
      // Transform the data to our VideoEntry type
      const entries: VideoEntry[] = data.map(media => {
        // Find associated asset (if any)
        // const assets = media.assets as any[] || [];
        // const asset = assets.length > 0 ? assets[0] : null;
        
        const entry: VideoEntry = {
          id: media.id,
          url: media.url,
          reviewer_name: media.creator || 'Unknown',
          skipped: false,
          created_at: media.created_at,
          admin_status: media.admin_status || 'Listed',
          user_status: media.user_status || null,
          user_id: media.user_id,
          admin_reviewed: media.admin_reviewed || false,
          metadata: {
            title: media.title,
            description: media.description || '',
            classification: (media.classification as 'art' | 'gen') || 'gen',
            isPrimary: false,
            aspectRatio: (media.metadata as any)?.aspectRatio || 16/9,
          }
        };
        
        return entry;
      });
      
      return entries;
    } catch (error) {
      this.logger.error('Error getting entries from Supabase:', JSON.stringify(error, null, 2));
      return [];
    }
  }
  
  async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
    try {
      // Prepare the update object for the 'media' table
      const mediaUpdate: Record<string, any> = {};
      if (update.metadata?.title) mediaUpdate.title = update.metadata.title;
      if (update.metadata?.description) mediaUpdate.description = update.metadata.description;
      if (update.metadata?.classification) mediaUpdate.classification = update.metadata.classification;
      if (update.admin_status !== undefined) mediaUpdate.admin_status = update.admin_status;
      if (update.user_status !== undefined) mediaUpdate.user_status = update.user_status;
      if (update.admin_reviewed !== undefined) mediaUpdate.admin_reviewed = update.admin_reviewed;
      if (update.placeholder_image) mediaUpdate.placeholder_image = update.placeholder_image;
      if (update.metadata?.aspectRatio) {
        if (!mediaUpdate.metadata) mediaUpdate.metadata = {};
        mediaUpdate.metadata.aspectRatio = update.metadata.aspectRatio;
      }

      // Only proceed if there's something to update
      if (Object.keys(mediaUpdate).length === 0) {
        this.logger.log(`No fields to update for media ${id}. Returning existing data.`);
        // Fetch existing data if nothing to update, to return consistent object
         const { data: existingData, error: fetchError } = await supabase
           .from('media')
           .select('*')
           .eq('id', id)
           .single();
         if (fetchError || !existingData) {
           this.logger.error(`Error fetching existing media ${id}:`, fetchError);
           return null;
         }
         // Map existing data back (simplified for brevity)
         const mappedData: VideoEntry = {
           id: existingData.id,
           url: existingData.url,
           reviewer_name: existingData.creator || 'Unknown',
           skipped: false,
           created_at: existingData.created_at,
           admin_status: (existingData.admin_status as AdminStatus) || null,
           user_status: (existingData.user_status as AdminStatus) || null,
           user_id: existingData.user_id,
           admin_reviewed: existingData.admin_reviewed || false,
           metadata: {
             title: existingData.title || '',
             description: existingData.description || '',
             classification: (existingData.classification as 'art' | 'gen') || 'gen',
             isPrimary: false,
             aspectRatio: (existingData.metadata as any)?.aspectRatio || 16/9,
           },
           associatedAssetId: null,
           placeholder_image: existingData.placeholder_image,
         };
         return mappedData;
      }
      
      const { data, error } = await supabase
        .from('media')
        .update(mediaUpdate)
        .eq('id', id)
        .select('*')
        .single();
      
      if (error) {
        this.logger.error(`Error updating media ${id}:`, error);
        return null;
      }
      
      // Map the returned data to VideoEntry
      const updatedEntry: VideoEntry = {
        id: data.id,
        url: data.url,
        reviewer_name: data.creator || 'Unknown',
        skipped: false,
        created_at: data.created_at,
        admin_status: (data.admin_status as AdminStatus) || null,
        user_status: (data.user_status as AdminStatus) || null,
        user_id: data.user_id,
        admin_reviewed: data.admin_reviewed || false,
        metadata: {
          title: data.title || '',
          description: data.description || '',
          classification: (data.classification as 'art' | 'gen') || 'gen',
          isPrimary: false,
          aspectRatio: (data.metadata as any)?.aspectRatio || 16/9,
        },
        associatedAssetId: null,
        placeholder_image: data.placeholder_image,
      };
      
      return updatedEntry;
    } catch (error) {
      this.logger.error(`Error updating entry ${id}:`, error);
      return null;
    }
  }
  
  async markAsSkipped(id: string): Promise<VideoEntry | null> {
    this.logger.warn(`markAsSkipped called for ${id}, but 'skipped' is not a DB field. No DB update performed.`);
    return this.updateEntry(id, { skipped: true });
  }
  
  async setApprovalStatus(id: string, status: AdminStatus): Promise<VideoEntry | null> {
    this.logger.log(`Setting admin status for entry ${id} to ${status} and marking as reviewed.`);
    
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
    
    return this.updateEntry(id, { admin_status: status, admin_reviewed: true });
  }
  
  async setReviewedStatus(id: string, reviewed: boolean): Promise<VideoEntry | null> {
    this.logger.log(`Setting reviewed status for entry ${id} to ${reviewed}.`);

    if (this.currentUserId) {
      const isAdmin = await checkIsAdmin(this.currentUserId);
      if (!isAdmin) {
        this.logger.error('Non-admin user attempted to set reviewed status');
        throw new Error('Permission denied: Only admins can change reviewed status');
      }
    } else {
      this.logger.error('Unauthenticated user attempted to set reviewed status');
      throw new Error('Authentication required to change reviewed status');
    }
    
    return this.updateEntry(id, { admin_reviewed: reviewed });
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
        this.logger.error(`Error deleting media ${id}:`, JSON.stringify(deleteError, null, 2));
        return false;
      }
      
      this.logger.log(`Deleted media entry: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting entry ${id}:`, JSON.stringify(error, null, 2));
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
      this.logger.error('Error clearing entries from Supabase:', JSON.stringify(error, null, 2));
    }
  }
}

export const videoEntryService = new VideoEntryService();
