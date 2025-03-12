
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
    localStorage.setItem('video_storage_config', JSON.stringify({
      ...config,
      // Don't store AWS secret key in localStorage for security
      awsSecretKey: config.awsSecretKey ? '[SECRET STORED]' : undefined
    }));
    this.log(`Storage configured as ${config.type}`);
    
    // Store sensitive AWS secrets in sessionStorage instead of localStorage
    if (config.type === 'aws' && config.awsSecretKey) {
      sessionStorage.setItem('aws_secret_key', config.awsSecretKey);
    } else {
      sessionStorage.removeItem('aws_secret_key');
    }
  }

  // Get current configuration
  getConfig(): StorageConfig {
    // For AWS config, retrieve the secret key from sessionStorage
    if (this.config.type === 'aws') {
      const secretKey = sessionStorage.getItem('aws_secret_key');
      return {
        ...this.config,
        awsSecretKey: secretKey || undefined
      };
    }
    return this.config;
  }

  // Load configuration from localStorage
  private loadConfig(): void {
    try {
      const savedConfig = localStorage.getItem('video_storage_config');
      if (savedConfig) {
        this.config = JSON.parse(savedConfig);
        
        // For AWS config, try to get the secret key from sessionStorage
        if (this.config.type === 'aws') {
          const secretKey = sessionStorage.getItem('aws_secret_key');
          if (secretKey) {
            this.config.awsSecretKey = secretKey;
          }
        }
        
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
    } else if (this.config.type === 'aws') {
      return this.uploadToAWS(videoFile);
    } else if (this.config.type === 'remote' && this.config.remoteUrl) {
      return this.uploadToRemoteServer(videoFile);
    } else {
      throw new Error('Remote storage not configured');
    }
  }
  
  // Upload to AWS S3
  private async uploadToAWS(videoFile: VideoFile): Promise<string> {
    if (!this.config.awsBucket || !this.config.awsRegion || 
        !this.config.awsAccessKey || !this.config.awsSecretKey) {
      throw new Error('AWS storage not fully configured');
    }

    try {
      this.log(`Uploading video ${videoFile.id} to AWS S3`);
      
      // For AWS S3 uploads we would typically use the AWS SDK
      // Here we'll use a pre-signed URL approach for simplicity
      
      // First, get a pre-signed URL for the upload
      const presignedUrlEndpoint = `https://${this.config.awsRegion}.aws-presigned-url-service.com/generate`;
      const presignedUrlResponse = await fetch(presignedUrlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucket: this.config.awsBucket,
          key: `videos/${videoFile.id}.webm`,
          accessKey: this.config.awsAccessKey,
          // Note: In a real implementation, you would NOT send the secret key to your backend
          // Your backend would securely store and use it instead
          secretKey: '[SECRET]', // Placeholder - real implementation would use a different approach
        }),
      });

      if (!presignedUrlResponse.ok) {
        throw new Error(`Failed to get pre-signed URL: ${presignedUrlResponse.status}`);
      }

      const { uploadUrl, fileUrl } = await presignedUrlResponse.json();
      
      // Then upload the file using the pre-signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: videoFile.blob,
        headers: {
          'Content-Type': 'video/webm',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload to S3: ${uploadResponse.status}`);
      }
      
      this.log(`Video uploaded successfully to AWS S3, URL: ${fileUrl}`);
      return fileUrl;
    } catch (error) {
      this.error('Failed to upload video to AWS:', error);
      throw error;
    }
  }
  
  // Upload to custom remote server
  private async uploadToRemoteServer(videoFile: VideoFile): Promise<string> {
    if (!this.config.remoteUrl) {
      throw new Error('Remote server URL not configured');
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
    if (this.config.type === 'supabase') {
      return supabaseStorage.getVideoUrl(remoteUrl);
    }
    return remoteUrl; // Remote URLs are already accessible
  }

  // Delete a video from the storage
  async deleteVideo(remoteUrl: string): Promise<boolean> {
    if (this.config.type === 'supabase') {
      return supabaseStorage.deleteVideo(remoteUrl);
    } else if (this.config.type === 'aws') {
      return this.deleteFromAWS(remoteUrl);
    } else if (this.config.type === 'remote' && this.config.remoteUrl) {
      return this.deleteFromRemoteServer(remoteUrl);
    } else {
      throw new Error('Remote storage not configured');
    }
  }
  
  // Delete from AWS S3
  private async deleteFromAWS(fileUrl: string): Promise<boolean> {
    if (!this.config.awsBucket || !this.config.awsRegion || 
        !this.config.awsAccessKey || !this.config.awsSecretKey) {
      throw new Error('AWS storage not fully configured');
    }

    try {
      this.log(`Deleting video from AWS S3: ${fileUrl}`);
      
      // Extract the object key from the fileUrl
      // This assumes the fileUrl follows a pattern like https://bucket.s3.region.amazonaws.com/key
      const urlParts = new URL(fileUrl);
      const key = urlParts.pathname.substring(1); // Remove leading slash
      
      const deleteEndpoint = `https://${this.config.awsRegion}.aws-delete-service.com/delete`;
      const response = await fetch(deleteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucket: this.config.awsBucket,
          key: key,
          accessKey: this.config.awsAccessKey,
          // Note: In a real implementation, you would NOT send the secret key to your backend
          secretKey: '[SECRET]', // Placeholder
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete from S3: ${response.status}`);
      }

      this.log(`Video deleted from AWS S3: ${fileUrl}`);
      return true;
    } catch (error) {
      this.error('Failed to delete video from AWS S3:', error);
      return false;
    }
  }
  
  // Delete from custom remote server
  private async deleteFromRemoteServer(remoteUrl: string): Promise<boolean> {
    if (!this.config.remoteUrl) {
      throw new Error('Remote server URL not configured');
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
