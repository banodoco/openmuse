
import { VideoFile } from './types';
import { supabaseStorage } from './supabaseStorage';

class RemoteVideoStorage {
  private readonly DEBUG = true;

  // Upload a video to the storage
  async uploadVideo(videoFile: VideoFile): Promise<string> {
    this.log(`Uploading video: ${videoFile.id}`);
    return supabaseStorage.uploadVideo(videoFile);
  }

  // Get a video from the remote server
  async getVideoUrl(remoteUrl: string): Promise<string> {
    return supabaseStorage.getVideoUrl(remoteUrl);
  }

  // Delete a video from the storage
  async deleteVideo(remoteUrl: string): Promise<boolean> {
    return supabaseStorage.deleteVideo(remoteUrl);
  }

  // Get storage configuration
  getConfig() {
    return { type: 'supabase' };
  }

  // Utility methods for logging
  private log(...args: any[]): void {
    if (this.DEBUG) console.log('[RemoteStorage]', ...args);
  }

  private warn(...args: any[]): void {
    if (this.DEBUG) console.warn('[RemoteStorage]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[RemoteStorage]', ...args);
  }
}

export const remoteStorage = new RemoteVideoStorage();
