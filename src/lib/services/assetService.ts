import { supabase } from '../supabase';
import { LoraAsset, AdminStatus } from '../types';
import { Logger } from '../logger';
import { checkIsAdmin } from '../auth';

export class AssetService {
  private readonly logger = new Logger('AssetService');
  private currentUserId: string | null = null;

  setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
    this.logger.log(`Current user ID set to: ${userId || 'none'}`);
  }

  async getAllAssets(): Promise<LoraAsset[]> {
    try {
      this.logger.log("[adminview] getAllAssets: Fetching session status...");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        this.logger.error("[adminview] getAllAssets: Error fetching session:", sessionError);
      } else {
        this.logger.log(`[adminview] getAllAssets: User authenticated: ${!!session?.user}, User ID: ${session?.user?.id || 'N/A'}`);
      }

      this.logger.log("Getting all assets from assets table");

      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          primaryVideo:primary_media_id(*),
          asset_media(
            media(id, url, placeholder_image, title)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('[adminview] Supabase query error in getAllAssets:', JSON.stringify(error, null, 2));
        throw error;
      }

      this.logger.log(`[adminview] Retrieved ${data?.length || 0} assets from Supabase raw query.`);

      const assets: LoraAsset[] = data.map(asset => {
        const pVideo = asset.primaryVideo;
        
        // Extract media information including videos and thumbnails
        const associatedMedia = (asset.asset_media || [])
          .slice(0, 4) // Limit to 4
          .map((am: any) => ({
            id: am.media?.id,
            url: am.media?.url,
            thumbnailUrl: am.media?.placeholder_image,
            title: am.media?.title
          }))
          .filter(m => m.id && (m.url || m.thumbnailUrl)); // Remove entries without id or either url

        // Basic transformation, might need more details later
        return {
          id: asset.id,
          name: asset.name,
          description: asset.description,
          creator: asset.creator,
          creatorDisplayName: asset.creator,
          type: asset.type,
          created_at: asset.created_at,
          user_id: asset.user_id,
          primary_media_id: asset.primary_media_id,
          admin_status: asset.admin_status || 'Listed',
          user_status: asset.user_status || null,
          lora_type: asset.lora_type,
          lora_base_model: asset.lora_base_model,
          model_variant: asset.model_variant,
          lora_link: asset.lora_link,
          primaryVideo: pVideo ? {
            id: pVideo.id,
            url: pVideo.url,
            reviewer_name: '',
            skipped: false,
            created_at: pVideo.created_at,
            admin_status: pVideo.admin_status,
            user_status: pVideo.user_status,
            user_id: pVideo.user_id,
            placeholder_image: pVideo.placeholder_image,
            thumbnailUrl: pVideo.placeholder_image,
            title: pVideo.title,
            description: pVideo.description,
          } : undefined,
          associatedMedia,
          associatedThumbnails: associatedMedia.map(m => m.thumbnailUrl).filter(Boolean)
        };
      });

      return assets;
    } catch (error) {
      // Log the caught error in detail
      this.logger.error('[adminview] Error caught in getAllAssets catch block:', JSON.stringify(error, null, 2)); // Log full error
      return [];
    }
  }

  async setAssetAdminStatus(assetId: string, status: AdminStatus): Promise<LoraAsset | null> {
    this.logger.log(`Setting admin status for asset ${assetId} to ${status}`);

    if (this.currentUserId) {
      const isAdmin = await checkIsAdmin(this.currentUserId);
      if (!isAdmin) {
        this.logger.error('Non-admin user attempted to set asset admin status');
        throw new Error('Permission denied: Only admins can change admin status');
      }
    } else {
      this.logger.error('Unauthenticated user attempted to set asset admin status');
      throw new Error('Authentication required to change admin status');
    }

    try {
      const { data, error } = await supabase
        .from('assets')
        .update({ admin_status: status })
        .eq('id', assetId)
        .select(`
            *,
            primaryVideo:primary_media_id(*)
        `) // Temporarily removed profile join
        .single();

      if (error) {
        this.logger.error(`Error updating asset ${assetId} status:`, JSON.stringify(error, null, 2)); // Log full error
        throw error;
      }

      const pVideo = data.primaryVideo;
      
      // Basic transformation after update
      const updatedAsset: LoraAsset = {
          id: data.id,
          name: data.name,
          description: data.description,
          creator: data.creator,
          creatorDisplayName: data.creator, // Fallback to creator column
          type: data.type,
          created_at: data.created_at,
          user_id: data.user_id,
          primary_media_id: data.primary_media_id,
          admin_status: data.admin_status || 'Listed', 
          user_status: data.user_status || null,
          lora_type: data.lora_type,
          lora_base_model: data.lora_base_model,
          model_variant: data.model_variant,
          lora_link: data.lora_link,
           primaryVideo: pVideo ? {
            id: pVideo.id,
            url: pVideo.url,
            reviewer_name: '', // Adjust if needed
            skipped: false,
            created_at: pVideo.created_at,
            admin_status: pVideo.admin_status,
            user_status: pVideo.user_status,
            user_id: pVideo.user_id,
            placeholder_image: pVideo.placeholder_image,
            thumbnailUrl: pVideo.placeholder_image,
            title: pVideo.title,
            description: pVideo.description,
          } : undefined,
        };

      return updatedAsset;
    } catch (error) {
      this.logger.error(`Error setting admin status for asset ${assetId}:`, JSON.stringify(error, null, 2)); // Log full error
      return null;
    }
  }

  async deleteAsset(assetId: string): Promise<boolean> {
    try {
       if (this.currentUserId) {
        const isAdmin = await checkIsAdmin(this.currentUserId);
        // Potentially allow owner deletion as well if needed
        // const { data: assetOwner } = await supabase.from('assets').select('user_id').eq('id', assetId).single();
        // const isOwner = assetOwner?.user_id === this.currentUserId;
        // if (!isAdmin && !isOwner) { ... }
        if (!isAdmin) {
          this.logger.error('Non-admin user attempted to delete asset');
          throw new Error('Permission denied: Only admins can delete assets'); // Adjust if owner deletion is allowed
        }
      } else {
        this.logger.error('Unauthenticated user attempted to delete asset');
        throw new Error('Authentication required to delete assets');
      }
      
      this.logger.log(`Attempting deletion for asset ID: ${assetId}`);

      // --- START: Revised Deletion logic ---
      
      // 1. Fetch associated media
      const { data: associatedMedia, error: fetchMediaError } = await supabase
        .from('asset_media')
        .select('media:media_id(id, url, placeholder_image)') // Select media details via foreign key
        .eq('asset_id', assetId);

      if (fetchMediaError) {
        this.logger.error(`Failed to fetch associated media for asset ${assetId}:`, fetchMediaError);
        // Log warning and proceed with asset deletion attempt
      }
      
      // Initialize arrays for paths and IDs
      const videoPaths: string[] = [];
      const thumbnailPaths: string[] = [];
      const mediaIds: string[] = [];

      // Define the expected type for the single nested media object
      type FetchedMedia = {
        id: string;
        url?: string | null;
        placeholder_image?: string | null;
      };

      // 2. Process fetched media data safely
      if (associatedMedia) {
        for (const am of associatedMedia) {
          let mediaData: FetchedMedia | null = null;

          // Check if am.media exists and is an array (as linter suggests) or object (expected)
          if (Array.isArray(am.media) && am.media.length > 0) {
            mediaData = am.media[0] as FetchedMedia; // Take the first element if array
          } else if (am.media && typeof am.media === 'object' && !Array.isArray(am.media)) {
            mediaData = am.media as FetchedMedia; // Cast directly if object
          }

          // Check if mediaData is not null and has an id
          if (mediaData && mediaData.id) {
            mediaIds.push(mediaData.id); // Add ID to list
            // Check for url and placeholder_image properties before accessing
            if (mediaData.url) {
              videoPaths.push(mediaData.url); // Add URL if it exists
            }
            if (mediaData.placeholder_image) {
              thumbnailPaths.push(mediaData.placeholder_image); // Add placeholder if it exists
            }
          }
        }
      }
      this.logger.log(`Found ${mediaIds.length} associated media records to process for deletion.`);

      // 3. Delete files from storage (non-blocking errors)
      if (videoPaths.length > 0) {
        this.logger.log(`Deleting ${videoPaths.length} video files from storage.`);
        const { error: storageVideoError } = await supabase.storage
          .from('videos')
          .remove(videoPaths);
        if (storageVideoError) this.logger.warn('Error deleting video files from storage (non-blocking):', storageVideoError);
      }
      if (thumbnailPaths.length > 0) {
        this.logger.log(`Deleting ${thumbnailPaths.length} thumbnail files from storage.`);
        const { error: storageThumbnailError } = await supabase.storage
          .from('thumbnails')
          .remove(thumbnailPaths);
        if (storageThumbnailError) this.logger.warn('Error deleting thumbnail files from storage (non-blocking):', storageThumbnailError);
      }
      
      // 4. Delete asset_media join table entries first
      // It's generally safer to remove joins before deleting the related records
      this.logger.log(`Deleting asset_media join records for asset ${assetId}.`);
      const { error: joinDeleteError } = await supabase
          .from('asset_media')
          .delete()
          .eq('asset_id', assetId);
      // Log error if it occurs, but don't necessarily stop the whole process
      if (joinDeleteError) this.logger.error(`Error deleting asset_media join records for asset ${assetId}:`, joinDeleteError);

      // 5. Delete media records themselves
      if (mediaIds.length > 0) {
          this.logger.log(`Deleting ${mediaIds.length} associated media records from database.`);
          const { error: mediaDbError } = await supabase
            .from('media')
            .delete()
            .in('id', mediaIds);
          if (mediaDbError) {
            this.logger.error('Error deleting associated media records from database:', mediaDbError);
            // Log error, but proceed to delete the asset itself
          }
      }
      // --- END: Revised Deletion logic ---

      // 6. Delete the asset record itself
      this.logger.log(`Deleting asset record ${assetId} from database.`);
      const { error: assetDbError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);

      if (assetDbError) {
        this.logger.error(`Failed to delete asset record ${assetId} from database:`, assetDbError);
        throw assetDbError; // Make this fatal
      }

      this.logger.log(`Successfully deleted asset ${assetId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting asset ${assetId}:`, JSON.stringify(error, null, 2)); // Log full error
      return false;
    }
  }
  
  // Potentially add clearAllAssets() similar to videoEntryService if needed
}

export const assetService = new AssetService(); 