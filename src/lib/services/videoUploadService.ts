
import { VideoEntry, VideoFile, VideoMetadata } from '../types';
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

      // Create the database entry with the video path
      const entry = {
        id: videoId,
        video_location: videoPath,
        reviewer_name: reviewerName,
        skipped: false,
        admin_approved: false,
        user_id: userId || this.currentUserId,
        metadata: videoFile.metadata || null
      };
      
      // Insert the entry into the database - cast metadata to any to bypass type checking
      const { data, error } = await supabase
        .from('video_entries')
        .insert({
          ...entry,
          metadata: entry.metadata as any
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating video entry in database:', error);
        throw error;
      }

      logger.log(`Video entry created successfully: ${videoId}`);
      
      // Convert the response to our VideoEntry type
      return {
        ...data,
        metadata: data.metadata as VideoEntry['metadata']
      } as VideoEntry;
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
      
      const { data, error } = await supabase
        .from('video_entries')
        .insert({
          video_location: entryData.video_location,
          reviewer_name: entryData.reviewer_name,
          acting_video_location: entryData.acting_video_location,
          skipped: entryData.skipped || false,
          user_id: entryData.user_id || this.currentUserId,
          metadata: entryData.metadata as any // Cast to any to bypass type checking
        })
        .select()
        .single();
      
      if (error) {
        logger.error('Error adding video entry:', error);
        throw error;
      }
      
      // Convert the response to our VideoEntry type
      return {
        ...data,
        metadata: data.metadata as VideoEntry['metadata']
      } as VideoEntry;
    } catch (error) {
      logger.error('Error in addEntry:', error);
      throw error;
    }
  }
  
  // Upload an acting video response
  public async uploadActingVideo(originalVideoId: string, actingVideoFile: VideoFile): Promise<VideoEntry | null> {
    if (!actingVideoFile || !actingVideoFile.blob) {
      logger.error('Attempted to upload a null or invalid acting video file');
      throw new Error('Invalid acting video file');
    }

    try {
      const actingVideoPath = `acting-videos/${originalVideoId}.webm`;
      
      logger.log(`Uploading acting video to ${actingVideoPath}`);
      
      // Upload the acting video file
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(actingVideoPath, actingVideoFile.blob, {
          contentType: 'video/webm',
          upsert: true,
        });

      if (uploadError) {
        logger.error('Error uploading acting video:', uploadError);
        throw uploadError;
      }

      logger.log(`Acting video uploaded successfully, updating entry for ${originalVideoId}`);

      // Update the database entry with the acting video path
      const { data, error } = await supabase
        .from('video_entries')
        .update({ acting_video_location: actingVideoPath })
        .eq('id', originalVideoId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating video entry with acting video:', error);
        throw error;
      }

      logger.log(`Video entry updated with acting video: ${originalVideoId}`);
      
      // Convert the response to our VideoEntry type
      return {
        ...data,
        metadata: data.metadata as VideoEntry['metadata']
      } as VideoEntry;
    } catch (error) {
      logger.error('Error in uploadActingVideo:', error);
      throw error;
    }
  }
  
  // Save an acting video path to an existing entry
  public async saveActingVideo(id: string, actingVideoLocation: string): Promise<VideoEntry | null> {
    try {
      logger.log(`Saving acting video location ${actingVideoLocation} for entry ${id}`);
      
      const { data, error } = await supabase
        .from('video_entries')
        .update({ acting_video_location: actingVideoLocation })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        logger.error(`Error saving acting video for entry ${id}:`, error);
        throw error;
      }
      
      // Convert the response to our VideoEntry type
      return {
        ...data,
        metadata: data.metadata as VideoEntry['metadata']
      } as VideoEntry;
    } catch (error) {
      logger.error('Error in saveActingVideo:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const videoUploadService = new VideoUploadService();
