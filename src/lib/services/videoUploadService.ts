
import { VideoEntry, VideoFile } from '../types';
import { Logger } from '../logger';
import { remoteStorage } from '../remoteStorage';
import { supabase } from '../supabase';

export class VideoUploadService {
  private readonly logger = new Logger('VideoUploadService');
  private currentUserId: string | null = null;
  
  setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
    this.logger.log(`Current user ID set to: ${userId || 'none'}`);
  }

  async addEntry(entry: Omit<VideoEntry, 'id' | 'created_at' | 'admin_approved'>): Promise<VideoEntry> {
    if (!this.currentUserId) {
      this.logger.warn('User not authenticated, proceeding without user_id');
    }
    
    let videoLocation = entry.video_location;
    
    if (entry.video_location.startsWith('blob:')) {
      try {
        const response = await fetch(entry.video_location);
        const blob = await response.blob();
        
        const videoFile = {
          id: `video_${Date.now()}`,
          blob
        };
        
        videoLocation = await remoteStorage.uploadVideo(videoFile);
        this.logger.log(`Saved video to Supabase Storage: ${videoLocation}`);
      } catch (error) {
        this.logger.error('Failed to save video to Supabase Storage:', error);
        throw error;
      }
    }
    
    try {
      const { data, error } = await supabase
        .from('video_entries')
        .insert({
          reviewer_name: entry.reviewer_name,
          video_location: videoLocation,
          skipped: entry.skipped || false,
          user_id: this.currentUserId,
          category: entry.category // Include category field
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.logger.log(`Added new entry: ${data.id}`);
      return data as VideoEntry;
    } catch (error) {
      this.logger.error('Error adding entry to Supabase:', error);
      throw error;
    }
  }
  
  async saveActingVideo(id: string, actingVideoLocation: string): Promise<VideoEntry | null> {
    this.logger.log(`Saving acting video for entry ${id}`);
    
    if (!this.currentUserId) {
      this.logger.warn('User not authenticated when saving acting video');
    }
    
    let savedLocation = actingVideoLocation;
    
    if (actingVideoLocation.startsWith('blob:')) {
      try {
        const response = await fetch(actingVideoLocation);
        const blob = await response.blob();
        const fileName = `acting_${id}_${Date.now()}.webm`;
        
        const { data: storageData, error: storageError } = await supabase.storage
          .from('videos')
          .upload(fileName, blob, {
            contentType: 'video/webm',
            upsert: true
          });
        
        if (storageError) {
          throw storageError;
        }
        
        const { data: urlData } = supabase.storage
          .from('videos')
          .getPublicUrl(fileName);
        
        savedLocation = urlData.publicUrl;
        this.logger.log(`Saved acting video to Supabase Storage: ${savedLocation}`);
      } catch (error) {
        this.logger.error('Failed to save acting video to Supabase Storage:', error);
        throw error;
      }
    }
    
    try {
      const { data, error } = await supabase
        .from('video_entries')
        .update({
          acting_video_location: savedLocation,
          user_id: this.currentUserId || undefined
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.logger.log(`Updated entry with acting video: ${id}`);
      return data as VideoEntry;
    } catch (error) {
      this.logger.error('Error updating entry in Supabase:', error);
      return null;
    }
  }
}

export const videoUploadService = new VideoUploadService();
