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
  
  public async uploadVideo(videoFile: VideoFile, reviewerName: string, userId?: string): Promise<VideoEntry | null> {
    if (!videoFile || !videoFile.blob) {
      logger.error('Attempted to upload a null or invalid video file');
      throw new Error('Invalid video file');
    }

    try {
      const videoId = videoFile.id || uuidv4();
      const videoPath = `videos/${videoId}.webm`;
      
      logger.log(`Uploading video to ${videoPath}`);
      
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

      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(videoPath);
      
      const videoUrl = publicUrlData.publicUrl;

      const videoTitle = videoFile.metadata?.title ? videoFile.metadata.title : 'Untitled Video';

      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .insert({
          title: videoTitle,
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
      
      const isExistingAsset = !!videoFile.metadata?.assetId;
      let assetId = videoFile.metadata?.assetId;
      
      if (isExistingAsset) {
        await this.addMediaToExistingAsset(
          mediaData.id, 
          assetId!, 
          videoFile.metadata?.isPrimary || false
        );
      } 
      else if (videoFile.metadata?.loraName) {
        assetId = await this.createNewAssetWithMedia(
          mediaData.id,
          videoFile.metadata.loraName,
          videoFile.metadata.loraDescription || '',
          videoFile.metadata.creatorName || reviewerName,
          userId || this.currentUserId,
          videoFile.metadata.loraType,
          videoFile.metadata.loraLink
        );
      }

      logger.log(`Media entry created successfully: ${mediaData.id}`);
      
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
  
  public async uploadVideoToExistingAsset(
    videoFile: VideoFile, 
    assetId: string, 
    reviewerName: string, 
    userId?: string,
    isPrimary: boolean = false
  ): Promise<VideoEntry | null> {
    if (!videoFile || !videoFile.blob || !assetId) {
      logger.error('Attempted to upload a null or invalid video file to asset');
      throw new Error('Invalid video file or asset ID');
    }

    try {
      const videoId = videoFile.id || uuidv4();
      const videoPath = `videos/${videoId}.webm`;
      
      logger.log(`Uploading video to ${videoPath} for asset ${assetId}`);
      
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

      logger.log(`Video uploaded successfully for asset ${assetId}, creating entry for ${videoId}`);

      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(videoPath);
      
      const videoUrl = publicUrlData.publicUrl;

      const videoTitle = videoFile.metadata?.title ? videoFile.metadata.title : 'Untitled Video';

      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .insert({
          title: videoTitle,
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
      
      await this.addMediaToExistingAsset(mediaData.id, assetId, isPrimary);
      
      logger.log(`Media ${mediaData.id} added to asset ${assetId}`);
      
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
      logger.error(`Error in uploadVideoToExistingAsset for asset ${assetId}:`, error);
      throw error;
    }
  }
  
  private async addMediaToExistingAsset(
    mediaId: string, 
    assetId: string, 
    isPrimary: boolean
  ): Promise<void> {
    logger.log(`Adding media ${mediaId} to existing asset ${assetId}`);
    
    try {
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('primary_media_id')
        .eq('id', assetId)
        .single();
        
      if (assetError) {
        logger.error(`Error getting asset data for ${assetId}:`, assetError);
        throw assetError;
      }
      
      const { error: linkError } = await supabase
        .from('asset_media')
        .insert({
          asset_id: assetId,
          media_id: mediaId
        });
        
      if (linkError) {
        logger.error('Error linking media to asset:', linkError);
        throw linkError;
      }
      
      const shouldSetAsPrimary = isPrimary || !assetData?.primary_media_id;
      
      if (shouldSetAsPrimary) {
        logger.log(`Setting media ${mediaId} as primary for asset ${assetId} (explicit: ${isPrimary}, no existing primary: ${!assetData?.primary_media_id})`);
        const { error: updateError } = await supabase
          .from('assets')
          .update({ primary_media_id: mediaId })
          .eq('id', assetId);
          
        if (updateError) {
          logger.error('Error updating primary media:', updateError);
        }
      } else {
        logger.log(`Not changing primary media for asset ${assetId}. Current primary: ${assetData?.primary_media_id}`);
      }
    } catch (error) {
      logger.error(`Error adding media ${mediaId} to asset ${assetId}:`, error);
      throw error;
    }
  }
  
  private async createNewAssetWithMedia(
    mediaId: string,
    loraName: string,
    loraDescription: string = '',
    creatorName: string,
    userId: string | null,
    loraType?: string,
    loraLink?: string
  ): Promise<string> {
    logger.log(`Creating new asset for LoRA: ${loraName}`);
    
    try {
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert({
          type: 'LoRA',
          name: loraName,
          description: loraDescription,
          creator: creatorName,
          user_id: userId,
          primary_media_id: mediaId,
          admin_approved: 'Listed',
          lora_type: loraType,
          lora_link: loraLink
        })
        .select()
        .single();
      
      if (assetError) {
        logger.error('Error creating asset:', assetError);
        throw assetError;
      }
      
      const assetId = assetData.id;
      
      const { error: linkError } = await supabase
        .from('asset_media')
        .insert({
          asset_id: assetId,
          media_id: mediaId
        });
        
      if (linkError) {
        logger.error('Error linking asset and media:', linkError);
        throw linkError;
      }
      
      logger.log(`Created new asset ${assetId} with primary media ${mediaId}`);
      return assetId;
    } catch (error) {
      logger.error('Error creating new asset with media:', error);
      throw error;
    }
  }
  
  public async addEntry(entryData: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    try {
      logger.log(`Adding new entry: ${JSON.stringify(entryData)}`);
      
      if (!entryData.reviewer_name) {
        throw new Error('Reviewer name is required for video entries');
      }
      
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
      
      const isExistingAsset = !!entryData.metadata?.assetId;
      let assetId = entryData.metadata?.assetId;
      
      if (isExistingAsset) {
        await this.addMediaToExistingAsset(
          mediaData.id, 
          assetId!, 
          entryData.metadata?.isPrimary || false
        );
      } 
      else if (entryData.metadata?.loraName) {
        assetId = await this.createNewAssetWithMedia(
          mediaData.id,
          entryData.metadata.loraName,
          entryData.metadata.loraDescription || '',
          entryData.metadata.creatorName || entryData.reviewer_name,
          entryData.user_id || this.currentUserId
        );
      }
      
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
  
  public async addEntryToExistingAsset(
    entryData: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>,
    assetId: string,
    isPrimary: boolean = false
  ): Promise<VideoEntry> {
    try {
      logger.log(`Adding new entry to existing asset ${assetId}: ${JSON.stringify(entryData)}`);
      
      if (!entryData.reviewer_name) {
        throw new Error('Reviewer name is required for video entries');
      }
      
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
      
      await this.addMediaToExistingAsset(mediaData.id, assetId, isPrimary);
      
      logger.log(`Media ${mediaData.id} added to asset ${assetId}`);
      
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
      logger.error(`Error in addEntryToExistingAsset for asset ${assetId}:`, error);
      throw error;
    }
  }
}

export const videoUploadService = new VideoUploadService();
