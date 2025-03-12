
import { VideoFile, StorageConfig } from './types';

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

  // Upload a video to the remote server
  async uploadVideo(videoFile: VideoFile): Promise<string> {
    if (this.config.type !== 'remote' || !this.config.remoteUrl) {
      throw new Error('Remote storage not configured');
    }

    try {
      this.log(`Uploading video ${videoFile.id} to remote storage`);
      
      const formData = new FormData();
      formData.append('file', videoFile.blob, `${videoFile.id}.webm`);
      if (this.config.apiKey) {
        formData.append('apiKey', this.config.apiKey);
      }

      const response = await fetch(this.config.remoteUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.url) {
        throw new Error('Server did not return a valid URL');
      }
      
      this.log(`Video uploaded successfully, URL: ${data.url}`);
      return data.url;
    } catch (error) {
      this.error('Failed to upload video:', error);
      throw error;
    }
  }

  // Get a video from the remote server
  async getVideoUrl(remoteUrl: string): Promise<string> {
    return remoteUrl; // Remote URLs are already accessible
  }

  // Delete a video from the remote server
  async deleteVideo(remoteUrl: string): Promise<boolean> {
    if (this.config.type !== 'remote' || !this.config.remoteUrl) {
      throw new Error('Remote storage not configured');
    }

    try {
      this.log(`Deleting video from remote storage: ${remoteUrl}`);
      
      const deleteUrl = `${this.config.remoteUrl}/delete`;
      
      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: remoteUrl,
          apiKey: this.config.apiKey 
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      this.log(`Video deleted from remote storage: ${remoteUrl}`);
      return true;
    } catch (error) {
      this.error('Failed to delete video from remote storage:', error);
      return false;
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
