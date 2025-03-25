
export interface VideoMetadata {
  title: string;
  description?: string;
  creator: 'self' | 'someone_else';
  creatorName?: string;
  classification: 'art' | 'gen';
  url?: string;
  model?: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  // LoRA details
  loraName?: string;
  loraDescription?: string;
  // Asset reference
  assetId?: string;
  // Primary media flag
  isPrimary?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  created_at?: string;
  avatar_url?: string | null;
  video_upload_consent?: boolean;
}

export interface VideoEntry {
  id: string;
  video_location: string;
  acting_video_location?: string;
  reviewer_name: string;
  skipped: boolean;
  created_at: string;
  admin_approved: boolean | null;
  user_id: string | null;
  metadata?: VideoMetadata;
}

export interface VideoFile {
  id: string;
  blob: Blob;
  metadata?: VideoMetadata;
}

export interface RecordedVideo {
  blob: Blob;
  url: string;
}
