import { VideoEntry, AdminStatus } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { BaseDatabase } from './BaseDatabase';
import { videoUrlService } from '../services/videoUrlService';
import { Logger } from '@/lib/logger';
import { checkIsAdmin } from "@/lib/auth/userRoles";
import { PostgrestError } from "@supabase/supabase-js";
import { databaseSwitcher } from "@/lib/databaseSwitcher";

// Tag for logging
const LOG_TAG = 'SessionPersist';

/**
 * Supabase implementation of the video database
 */
export class SupabaseDatabase extends BaseDatabase {
  constructor() {
    super('SupabaseDB', true, LOG_TAG);
  }
  
  async getAllEntries(approvalFilter: 'all' | 'curated' = 'all'): Promise<VideoEntry[]> {
    this.logger.log(`[getAllEntries] Fetching videos with filter: ${approvalFilter}`);
    const queryStart = performance.now(); // Start timing before query construction
    try {
      let query = supabase.from('media').select('*, assets(id, name, description, type, creator)');

      if (approvalFilter === 'curated') {
        this.logger.log('[getAllEntries] Applying curated filter: admin_status in (Curated, Featured)');
        query = query.in('admin_status', ['Curated', 'Featured']); // Correctly use IN for multiple values
      }

      query = query.eq('type', 'video').order('created_at', { ascending: false });
      
      this.logger.log(`[getAllEntries] Executing Supabase query...`);
      const { data, error } = await query;
      const queryDuration = (performance.now() - queryStart).toFixed(2);
      this.logger.log(`[getAllEntries] Supabase query finished in ${queryDuration} ms`);

      if (error) {
        this.logger.error('[getAllEntries] Supabase query error:', error);
        // Re-throw the error so the caller (useVideoManagement) can catch it
        throw new Error(`Error fetching video entries: ${error.message}`);
      }

      if (!data) {
        this.logger.warn('[getAllEntries] Supabase query returned null data.');
        return []; // Return empty array if data is null
      }
      
      this.logger.log(`[getAllEntries] Fetched ${data.length} raw media entries.`);
      
      // Map entries (Consider adding timing here if mapping is complex)
      const entries: VideoEntry[] = data.map(media => {
        const asset = media.assets && media.assets.length > 0 ? media.assets[0] : null;
        
        return {
          id: media.id,
          url: media.url,
          title: media.title || '',
          description: media.description || '',
          type: media.type || 'video',
          storage_provider: media.storage_provider || 'supabase',
          reviewer_name: media.creator || 'Unknown',
          skipped: false,
          created_at: media.created_at,
          admin_status: media.admin_status || 'Listed',
          user_status: media.user_status || null,
          user_id: media.user_id,
          metadata: {
            title: media.title,
            description: media.description || '',
            creator: 'self',
            creatorName: media.creator || 'Unknown',
            classification: media.classification || 'art',
            loraName: asset?.name,
            loraDescription: asset?.description,
            assetId: asset?.id,
            isPrimary: false, // This will be updated later
            placeholder_image: media.placeholder_image,
            aspectRatio: (media.metadata as any)?.aspectRatio ?? null
          }
        };
      });

      // Fetch asset primary media info (Consider adding timing)
      const { data: assetMediaData, error: assetMediaError } = await supabase
        .from('assets')
        .select('id, primary_media_id');
      
      if (assetMediaError) {
        this.logger.error('[getAllEntries] Error fetching asset primary_media_id:', assetMediaError);
        // Continue without primary info if this fails, but log it
      } else if (assetMediaData) {
        const primaryMap = new Map(assetMediaData.map(a => [a.id, a.primary_media_id]));
        for (const entry of entries) {
          if (entry.metadata?.assetId) {
            const primaryMediaId = primaryMap.get(entry.metadata.assetId);
            if (primaryMediaId === entry.id) {
              entry.metadata.isPrimary = true;
            }
          }
        }
      }
      
      this.logger.log(`[getAllEntries] Returning ${entries.length} processed entries.`);
      return entries;
    } catch (e) {
      // Catch any error from the try block (query error, processing error)
      const totalDuration = (performance.now() - queryStart).toFixed(2);
      this.logger.error(`[getAllEntries] Error encountered after ${totalDuration} ms:`, e);
      // Re-throw the caught error
      throw e;
    }
  }
  
  async updateEntry(id: string, update: Partial<VideoEntry>): Promise<VideoEntry | null> {
    try {
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .update({
          title: update.title || update.metadata?.title,
          description: update.description || update.metadata?.description,
          classification: update.metadata?.classification,
          admin_status: update.admin_status
        })
        .eq('id', id)
        .select()
        .single();
      
      if (mediaError) {
        this.logger.error(`Error updating media ${id}:`, mediaError);
        return null;
      }
      
      if (update.metadata?.assetId) {
        const { error: assetError } = await supabase
          .from('assets')
          .update({
            name: update.metadata.loraName,
            description: update.metadata.loraDescription,
            admin_status: update.admin_status,
            user_status: update.user_status
          })
          .eq('id', update.metadata.assetId);
        
        if (assetError) {
          this.logger.error(`Error updating asset ${update.metadata.assetId}:`, assetError);
        }
      }
      
      const updatedEntry: VideoEntry = {
        id: mediaData.id,
        url: mediaData.url,
        title: mediaData.title || '',
        description: mediaData.description || '',
        type: mediaData.type || 'video',
        storage_provider: mediaData.storage_provider || 'supabase',
        reviewer_name: mediaData.creator || 'Unknown',
        skipped: update.skipped || false,
        created_at: mediaData.created_at,
        admin_status: mediaData.admin_status || 'Listed',
        user_status: mediaData.user_status || null,
        user_id: mediaData.user_id,
        metadata: {
          title: mediaData.title || '',
          description: update.metadata?.description || '',
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
  
  async setApprovalStatus(id: string, status: AdminStatus): Promise<VideoEntry | null> {
    this.logger.log(`Setting admin status for media ${id} to ${status}`);
    return this.updateEntry(id, { admin_status: status });
  }
  
  async getVideoUrl(videoLocation: string): Promise<string> {
    return videoUrlService.getVideoUrl(videoLocation);
  }

  async deleteEntry(id: string): Promise<boolean> {
    this.logger.error("deleteEntry not implemented in base SupabaseDatabase class");
    return false;
  }
  
  async clearAllEntries(): Promise<void> {
    this.logger.error("clearAllEntries not implemented in base SupabaseDatabase class");
  }
  
  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_status' | 'user_status'>): Promise<VideoEntry> {
    this.logger.error("addEntry not implemented in base SupabaseDatabase class");
    throw new Error("Method not implemented");
  }
}
