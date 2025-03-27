
import { VideoEntry } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { BaseDatabase } from './BaseDatabase';

/**
 * Supabase implementation of the video database
 */
export class SupabaseDatabase extends BaseDatabase {
  constructor() {
    super('SupabaseDB');
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
  
  async getVideoUrl(videoLocation: string): Promise<string> {
    // Return remote URLs as-is
    return videoLocation;
  }
