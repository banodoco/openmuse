import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, VideoEntry } from '@/lib/types';
import { Logger } from '@/lib/logger';

const logger = new Logger('AssetService');

export const fetchAssets = async (): Promise<LoraAsset[]> => {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        primary_media:media!assets_primary_media_id_fkey(
          id,
          url,
          title,
          description,
          type,
          storage_provider,
          placeholder_image,
          created_at,
          admin_status,
          user_status,
          user_id
        )
      `)
      .eq('type', 'lora')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map(asset => ({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      creator: asset.creator,
      type: asset.type as 'lora',
      created_at: asset.created_at,
      user_id: asset.user_id,
      primary_media_id: asset.primary_media_id,
      admin_status: asset.admin_status,
      admin_reviewed: asset.admin_reviewed,
      user_status: asset.user_status,
      lora_type: asset.lora_type,
      lora_base_model: asset.lora_base_model,
      model_variant: asset.model_variant,
      lora_link: asset.lora_link,
      download_link: asset.download_link,
      curator_id: asset.curator_id,
      primaryVideo: asset.primary_media ? {
        id: asset.primary_media.id,
        url: asset.primary_media.url,
        title: asset.primary_media.title || '',
        description: asset.primary_media.description || '',
        type: asset.primary_media.type || 'video',
        storage_provider: asset.primary_media.storage_provider || 'supabase',
        reviewer_name: 'Unknown',
        skipped: false,
        created_at: asset.primary_media.created_at,
        admin_status: asset.primary_media.admin_status,
        user_status: asset.primary_media.user_status,
        user_id: asset.primary_media.user_id,
        placeholder_image: asset.primary_media.placeholder_image,
        thumbnailUrl: asset.primary_media.placeholder_image
      } as VideoEntry : undefined,
      videos: []
    }));
  } catch (error) {
    logger.error('Error fetching assets:', error);
    throw error;
  }
};

export const fetchAssetById = async (id: string): Promise<LoraAsset | null> => {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        primary_media:media!assets_primary_media_id_fkey(
          id,
          url,
          title,
          description,
          type,
          storage_provider,
          placeholder_image,
          created_at,
          admin_status,
          user_status,
          user_id
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      creator: data.creator,
      type: data.type as 'lora',
      created_at: data.created_at,
      user_id: data.user_id,
      primary_media_id: data.primary_media_id,
      admin_status: data.admin_status,
      admin_reviewed: data.admin_reviewed,
      user_status: data.user_status,
      lora_type: data.lora_type,
      lora_base_model: data.lora_base_model,
      model_variant: data.model_variant,
      lora_link: data.lora_link,
      download_link: data.download_link,
      curator_id: data.curator_id,
      primaryVideo: data.primary_media ? {
        id: data.primary_media.id,
        url: data.primary_media.url,
        title: data.primary_media.title || '',
        description: data.primary_media.description || '',
        type: data.primary_media.type || 'video',
        storage_provider: data.primary_media.storage_provider || 'supabase',
        reviewer_name: 'Unknown',
        skipped: false,
        created_at: data.primary_media.created_at,
        admin_status: data.primary_media.admin_status,
        user_status: data.primary_media.user_status,
        user_id: data.primary_media.user_id,
        placeholder_image: data.primary_media.placeholder_image,
        thumbnailUrl: data.primary_media.placeholder_image
      } as VideoEntry : undefined,
      videos: []
    };
  } catch (error) {
    logger.error('Error fetching asset by ID:', error);
    return null;
  }
};

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
          admin_reviewed: asset.admin_reviewed || false,
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
    this.logger.log(`Setting admin status for asset ${assetId} to ${status} and marking as reviewed.`);

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
        .update({ admin_status: status, admin_reviewed: true })
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
          admin_reviewed: data.admin_reviewed || false,
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

  async setAssetReviewedStatus(assetId: string, reviewed: boolean): Promise<LoraAsset | null> {
    this.logger.log(`Setting reviewed status for asset ${assetId} to ${reviewed}.`);

    if (this.currentUserId) {
      const isAdmin = await checkIsAdmin(this.currentUserId);
      if (!isAdmin) {
        this.logger.error('Non-admin user attempted to set asset reviewed status');
        throw new Error('Permission denied: Only admins can change reviewed status');
      }
    } else {
      this.logger.error('Unauthenticated user attempted to set asset reviewed status');
      throw new Error('Authentication required to change reviewed status');
    }

    try {
      const { data, error } = await supabase
        .from('assets')
        .update({ admin_reviewed: reviewed })
        .eq('id', assetId)
        .select(`
            *,
            primaryVideo:primary_media_id(*)
        `) // Re-select needed data
        .single();

      if (error) {
        this.logger.error(`Error updating asset ${assetId} reviewed status:`, JSON.stringify(error, null, 2));
        throw error;
      }

      const pVideo = data.primaryVideo;
      
      // Map back to LoraAsset (similar to setAssetAdminStatus)
      const updatedAsset: LoraAsset = {
          id: data.id,
          name: data.name,
          description: data.description,
          creator: data.creator,
          creatorDisplayName: data.creator,
          type: data.type,
          created_at: data.created_at,
          user_id: data.user_id,
          primary_media_id: data.primary_media_id,
          admin_status: data.admin_status || 'Listed',
          admin_reviewed: data.admin_reviewed || false,
          user_status: data.user_status || null,
          lora_type: data.lora_type,
          lora_base_model: data.lora_base_model,
          model_variant: data.model_variant,
          lora_link: data.lora_link,
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
        };

      return updatedAsset;
    } catch (error) {
      this.logger.error(`Error setting reviewed status for asset ${assetId}:`, JSON.stringify(error, null, 2));
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
