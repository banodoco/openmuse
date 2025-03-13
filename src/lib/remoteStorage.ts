
import { VideoFile, StorageConfig } from './types';
import { supabaseStorage } from './supabaseStorage';

class RemoteVideoStorage {
  private readonly DEBUG = true;
  private config: StorageConfig = {
    type: 'local',
  };

  constructor() {
    // Initialize with default config
    this.loadConfig();
  }

  // Configure storage settings
  configure(config: StorageConfig): void {
    this.config = config;
    localStorage.setItem('video_storage_config', JSON.stringify(config));
    this.log(`Storage configured as ${config.type}`);
  }

  // Get current configuration
  getConfig(): StorageConfig {
    return this.config;
  }

  // Load configuration from localStorage
  private loadConfig(): void {
    try {
      const savedConfig = localStorage.getItem('video_storage_config');
      if (savedConfig) {
        this.config = JSON.parse(savedConfig);
        this.log(`Loaded storage config: ${this.config.type}`);
      }
    } catch (error) {
      this.error('Failed to load storage configuration:', error);
    }
  }

  // Upload a video to the storage
  async uploadVideo(videoFile: VideoFile): Promise<string> {
    if (this.config.type === 'supabase') {
      return supabaseStorage.uploadVideo(videoFile);
    } else {
      throw new Error('Remote storage not configured');
    }
  }

  // Get a video from the remote server
  async getVideoUrl(remoteUrl: string): Promise<string> {
    if (this.config.type === 'supabase') {
      return supabaseStorage.getVideoUrl(remoteUrl);
    }
    return remoteUrl; // Remote URLs are already accessible
  }

  // Delete a video from the storage
  async deleteVideo(remoteUrl: string): Promise<boolean> {
    if (this.config.type === 'supabase') {
      return supabaseStorage.deleteVideo(remoteUrl);
    } else {
      throw new Error('Remote storage not configured');
    }
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
