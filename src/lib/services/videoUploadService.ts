
import { VideoEntry, VideoFile, VideoMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase';
import { Logger } from '../logger';

const logger = new Logger('VideoUploadService');

export class VideoUploadService {
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
      const entry: Partial<VideoEntry> = {
        id: videoId,
        video_location: videoPath,
        reviewer_name: reviewerName,
        skipped: false,
        admin_approved: false,
      };
      
      // Add user ID if provided
      if (userId) {
        entry.user_id = userId;
      }
      
      // Add metadata if available
      if (videoFile.metadata) {
        entry.metadata = videoFile.metadata;
      }

      // Insert the entry into the database
      const { data, error } = await supabase
        .from('video_entries')
        .insert(entry)
        .select()
        .single();

      if (error) {
        logger.error('Error creating video entry in database:', error);
        throw error;
      }

      logger.log(`Video entry created successfully: ${videoId}`);
      return data as VideoEntry;
    } catch (error) {
      logger.error('Error in uploadVideo:', error);
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
      return data as VideoEntry;
    } catch (error) {
      logger.error('Error in uploadActingVideo:', error);
      throw error;
    }
  }
}
