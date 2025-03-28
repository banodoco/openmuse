
import { VideoEntry, VideoFile } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase';
import { Logger } from '../logger';

const logger = new Logger('VideoUploadService');

class VideoUploadService {
  private currentUserId: string | null = null;
  
  setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
    logger.log(`Current user ID set to: ${userId || 'none'}`);
  }
  
  // Upload a new video file to the storage
  public async uploadVideo(videoFile: VideoFile, reviewerName: string, userId?: string): Promise<VideoEntry | null> {
    if (!videoFile || !videoFile.blob) {
      logger.error('Attempted to upload a null or invalid video file');
      throw new Error('Invalid video file');
    }

    try {
      // Generate unique ID for the video
      const videoId = videoFile.id || uuidv4();
      const videoPath = `videos/${videoId}.webm`;
      
      logger.log(`Uploading video to ${videoPath}`);
      
      // Upload the video file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(videoPath, videoFile.blob, {
          contentType: 'video/webm',
          upsert: true,
        });

      if (uploadError) {
        logger.error('Error uploading video to storage:', uploadError);
        throw uploadError;
      }

      logger.log(`Video uploaded successfully, creating entry for ${videoId}`);

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(videoPath);
      
      const videoUrl = publicUrlData.publicUrl;

      // Create the media entry
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .insert({
          title: videoFile.metadata?.title || 'Untitled',
          url: videoUrl,
          type: 'video',
          classification: videoFile.metadata?.classification || 'art',
          creator: videoFile.metadata?.creatorName || reviewerName,
          user_id: userId || this.currentUserId,
          admin_approved: 'Listed'
        })
        .select()
        .single();

      if (mediaError) {
        logger.error('Error creating media entry:', mediaError);
        throw mediaError;
      }
      
      let assetId = videoFile.metadata?.assetId;
      
      // Create or link asset if needed
      if (videoFile.metadata?.loraName && !assetId) {
        // Create new asset
        const { data: assetData, error: assetError } = await supabase
          .from('assets')
          .insert({
            type: 'LoRA',
            name: videoFile.metadata.loraName,
            description: videoFile.metadata.loraDescription || '',
            creator: videoFile.metadata.creatorName || reviewerName,
            user_id: userId || this.currentUserId,
            primary_media_id: mediaData.id,
            admin_approved: 'Listed'
          })
          .select()
          .single();
        
        if (assetError) {
          logger.error('Error creating asset:', assetError);
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
        if (videoFile.metadata?.isPrimary) {
          await supabase
            .from('assets')
            .update({ primary_media_id: mediaData.id })
            .eq('id', assetId);
        }
      }

      logger.log(`Media entry created successfully: ${mediaData.id}`);
      
      // Construct the VideoEntry object
      const entry: VideoEntry = {
        id: mediaData.id,
        video_location: mediaData.url,
        reviewer_name: reviewerName,
        skipped: false,
        created_at: mediaData.created_at,
        admin_approved: 'Listed',
        user_id: mediaData.user_id,
        metadata: {
          ...(videoFile.metadata || {}),
          title: mediaData.title,
          assetId
        }
      };
      
      return entry;
    } catch (error) {
      logger.error('Error in uploadVideo:', error);
      throw error;
    }
  }
  
  // Add a new video entry to the database
  public async addEntry(entryData: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    try {
      logger.log(`Adding new entry: ${JSON.stringify(entryData)}`);
      
      // Ensure reviewer_name is present as it's required
      if (!entryData.reviewer_name) {
        throw new Error('Reviewer name is required for video entries');
      }
      
      // Create the media entry
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .insert({
          title: entryData.metadata?.title || 'Untitled',
          url: entryData.video_location,
          type: 'video',
          classification: entryData.metadata?.classification || 'art',
          creator: entryData.metadata?.creatorName || entryData.reviewer_name,
          user_id: entryData.user_id || this.currentUserId,
          admin_approved: 'Listed'
        })
        .select()
        .single();
      
      if (mediaError) {
        logger.error('Error creating media entry:', mediaError);
        throw mediaError;
      }
      
      let assetId = entryData.metadata?.assetId;
      
      // Create or update asset if needed
      if (entryData.metadata?.loraName && !assetId) {
        // Create new asset
        const { data: assetData, error: assetError } = await supabase
          .from('assets')
          .insert({
            type: 'LoRA',
            name: entryData.metadata.loraName,
            description: entryData.metadata.loraDescription || '',
            creator: entryData.metadata.creatorName || entryData.reviewer_name,
            user_id: entryData.user_id || this.currentUserId,
            primary_media_id: mediaData.id,
            admin_approved: 'Listed'
          })
          .select()
          .single();
        
        if (assetError) {
          logger.error('Error creating asset:', assetError);
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
        if (entryData.metadata?.isPrimary) {
          await supabase
            .from('assets')
            .update({ primary_media_id: mediaData.id })
            .eq('id', assetId);
        }
      }
      
      // Construct the VideoEntry object
      const newEntry: VideoEntry = {
        id: mediaData.id,
        video_location: mediaData.url,
        reviewer_name: entryData.reviewer_name,
        skipped: entryData.skipped || false,
        created_at: mediaData.created_at,
        admin_approved: 'Listed',
        user_id: mediaData.user_id,
        metadata: {
          ...(entryData.metadata || {}),
          title: mediaData.title,
          assetId
        }
      };
      
      return newEntry;
    } catch (error) {
      logger.error('Error in addEntry:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const videoUploadService = new VideoUploadService();
