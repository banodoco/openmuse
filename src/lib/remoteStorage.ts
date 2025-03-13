
import { VideoFile, StorageConfig } from './types';
import { supabaseStorage } from './supabaseStorage';

class RemoteVideoStorage {
  private readonly DEBUG = true;
  private config: StorageConfig = {
    type: 'supabase',
  };

  constructor() {
    // Initialize with default config
    this.loadConfig();
  }

  // Configure storage settings
  configure(config: StorageConfig): void {
    // Always use supabase regardless of what's passed
    this.config = { type: 'supabase' };
    localStorage.setItem('video_storage_config', JSON.stringify(this.config));
    this.log(`Storage configured as ${this.config.type}`);
  }

  // Get current configuration
  getConfig(): StorageConfig {
    return { type: 'supabase' };
  }

  // Load configuration from localStorage
  private loadConfig(): void {
    try {
      const savedConfig = localStorage.getItem('video_storage_config');
      if (savedConfig) {
        // Ignore the saved config and always use supabase
        this.config = { type: 'supabase' };
        this.log(`Using Supabase storage`);
      }
    } catch (error) {
      this.error('Failed to load storage configuration:', error);
    }
  }

  // Upload a video to the storage
  async uploadVideo(videoFile: VideoFile): Promise<string> {
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
