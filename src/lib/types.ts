

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

export interface UserProfile {
  id: string;
  username: string;
  avatar_url?: string;
  created_at?: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at?: string;
}

// Storage configuration options (simplified)
export interface StorageConfig {
  type: 'supabase';
}

// Session type for auth
export interface Session {
  user: {
    id: string;
    email?: string;
  };
}

// Add custom event type for TypeScript
declare global {
  interface MediaRecorderEventMap {
    dataavailable: BlobEvent;
  }
}

