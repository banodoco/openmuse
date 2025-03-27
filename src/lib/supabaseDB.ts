
import { VideoEntry } from './types';
import { Logger } from './logger';
import { supabase } from '@/integrations/supabase/client';

class SupabaseVideoDatabase {
  private readonly logger = new Logger('SupabaseDB');
  private currentUserId: string | null = null;
  
  setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
    this.logger.log(`Current user ID set to: ${userId || 'none'}`);
  }
  
  async getAllEntries(): Promise<VideoEntry[]> {
    try {
      this.logger.log("Getting all entries from media table");
      
      // Fetch media entries of type 'video'
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('*, assets(id, name, description, type, creator)')
        .eq('type', 'video')
        .order('created_at', { ascending: false });
      
      if (mediaError) {
        this.logger.error('Error getting media entries:', mediaError);
        return [];
      }
      
      this.logger.log(`Retrieved ${mediaData?.length || 0} media entries`);
      
      // Transform media entries to VideoEntry format
      const entries: VideoEntry[] = mediaData.map(media => {
        // Find associated asset (if any)
        const asset = media.assets && media.assets.length > 0 ? media.assets[0] : null;
        
        return {
          id: media.id,
          video_location: media.url,
          reviewer_name: media.creator || 'Unknown',
          skipped: false,
          created_at: media.created_at,
          admin_approved: false, // Default value 
          user_id: media.user_id,
          metadata: {
            title: media.title,
            description: '',
            creator: 'self',
            classification: media.classification || 'art',
            loraName: asset?.name,
            loraDescription: asset?.description,
            assetId: asset?.id,
            isPrimary: false // Will be updated later
          }
        };
      });
      
      // Get asset-media relationships to determine primary videos
      const { data: assetMediaData, error: assetMediaError } = await supabase
        .from('assets')
        .select('id, primary_media_id');
      
      if (!assetMediaError && assetMediaData) {
        // Mark primary videos
        for (const entry of entries) {
          if (entry.metadata?.assetId) {
            const asset = assetMediaData.find(a => a.id === entry.metadata?.assetId);
            if (asset && asset.primary_media_id === entry.id) {
              entry.metadata.isPrimary = true;
            }
          }
        }
      }
      
      return entries;
    } catch (error) {
      this.logger.error('Error getting entries:', error);
      return [];
    }
  }
  
  async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
    try {
      // Update the media entry
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .update({
          title: update.metadata?.title,
          classification: update.metadata?.classification,
          creator: update.metadata?.creatorName || update.reviewer_name
        })
        .eq('id', id)
        .select()
        .single();
      
      if (mediaError) {
        this.logger.error(`Error updating media ${id}:`, mediaError);
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
      
      // Construct the updated VideoEntry object
      const updatedEntry: VideoEntry = {
        id: mediaData.id,
        video_location: mediaData.url,
        reviewer_name: mediaData.creator || 'Unknown',
        skipped: update.skipped || false,
        created_at: mediaData.created_at,
        admin_approved: update.admin_approved || false,
        user_id: mediaData.user_id,
        metadata: {
          title: mediaData.title,
          description: update.metadata?.description || '',
          creator: update.metadata?.creator || 'self',
          classification: mediaData.classification || 'art',
          loraName: update.metadata?.loraName,
          loraDescription: update.metadata?.loraDescription,
          assetId: update.metadata?.assetId,
          isPrimary: update.metadata?.isPrimary || false
        }
      };
      
      return updatedEntry;
    } catch (error) {
      this.logger.error(`Error updating entry ${id}:`, error);
      return null;
    }
  }
  
  async markAsSkipped(id: string): Promise<VideoEntry | null> {
    return this.updateEntry(id, { skipped: true });
  }
  
  async setApprovalStatus(id: string, approved: boolean): Promise<VideoEntry | null> {
    this.logger.log(`Setting approval status for media ${id} to ${approved}`);
    return this.updateEntry(id, { admin_approved: approved });
  }
  
  async deleteEntry(id: string): Promise<boolean> {
    try {
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
  
  async getVideoUrl(videoLocation: string): Promise<string> {
    // Return remote URLs as-is
    return videoLocation;
  }
  
  async clearAllEntries(): Promise<void> {
    try {
      // Delete all asset_media relationships
      await supabase
        .from('asset_media')
        .delete()
        .neq('id', 'placeholder');
      
      // Delete all assets
      await supabase
        .from('assets')
        .delete()
        .neq('id', 'placeholder');
      
      // Delete all media
      await supabase
        .from('media')
        .delete()
        .neq('id', 'placeholder');
      
      this.logger.log('Cleared all entries');
    } catch (error) {
      this.logger.error('Error clearing entries:', error);
    }
  }
  
  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    try {
      // Create the media entry
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .insert({
          title: entry.metadata?.title || 'Untitled',
          url: entry.video_location,
          type: 'video',
          classification: entry.metadata?.classification || 'art',
          creator: entry.metadata?.creatorName || entry.reviewer_name,
          user_id: entry.user_id || this.currentUserId
        })
        .select()
        .single();
      
      if (mediaError) {
        this.logger.error('Error creating media entry:', mediaError);
        throw mediaError;
      }
      
      let assetId = entry.metadata?.assetId;
      
      // Create or update asset if needed
      if (entry.metadata?.loraName && !assetId) {
        // Create new asset
        const { data: assetData, error: assetError } = await supabase
          .from('assets')
          .insert({
            type: 'LoRA',
            name: entry.metadata.loraName,
            description: entry.metadata.loraDescription || '',
            creator: entry.metadata.creatorName || entry.reviewer_name,
            user_id: entry.user_id || this.currentUserId,
            primary_media_id: mediaData.id
          })
          .select()
          .single();
        
        if (assetError) {
          this.logger.error('Error creating asset:', assetError);
        } else {
          assetId = assetData.id;
          
          // Link asset and media
          await supabase
            .from('asset_media')
            .insert({
              asset_id: assetId,
              media_id: mediaData.id
            });
        }
      } else if (assetId) {
        // Link to existing asset
        await supabase
          .from('asset_media')
          .insert({
            asset_id: assetId,
            media_id: mediaData.id
          });
        
        // Update primary media if this is primary
        if (entry.metadata?.isPrimary) {
          await supabase
            .from('assets')
            .update({ primary_media_id: mediaData.id })
            .eq('id', assetId);
        }
      }
      
      // Construct the new VideoEntry object
      const newEntry: VideoEntry = {
        id: mediaData.id,
        video_location: mediaData.url,
        reviewer_name: entry.reviewer_name,
        skipped: entry.skipped || false,
        created_at: mediaData.created_at,
        admin_approved: false,
        user_id: mediaData.user_id,
        metadata: {
          ...(entry.metadata || {}),
          title: mediaData.title,
          assetId
        }
      };
      
      return newEntry;
    } catch (error) {
      this.logger.error('Error adding entry:', error);
      throw error;
    }
  }
  
  // Add the alias for addEntry
  async createEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    this.logger.log('createEntry called, using addEntry method');
    return this.addEntry(entry);
  }
}

export const supabaseDB = new SupabaseVideoDatabase();
