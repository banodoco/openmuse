
export interface VideoEntry {
  id: string;
  video_location: string;
  reviewer_name: string;
  acting_video_location: string | null;
  skipped: boolean;
  created_at: string;
  admin_approved: boolean;
  user_id?: string;
}

export interface RecordedVideo {
  blob: Blob;
  url: string;
}

export interface VideoFile {
  id: string;
  blob: Blob;
}

// Storage configuration options
export interface StorageConfig {
  type: 'local' | 'remote' | 'aws' | 'supabase';
  remoteUrl?: string;
  apiKey?: string;
  awsRegion?: string;
  awsBucket?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
}

// Add custom event type for TypeScript
declare global {
  interface MediaRecorderEventMap {
    dataavailable: BlobEvent;
  }
}
