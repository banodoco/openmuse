
export interface VideoMetadata {
  title: string;
  description?: string;
  creator?: 'self' | 'someone_else';
  creatorName?: string;
  classification?: string;
  isPrimary?: boolean;
  loraName?: string;
  loraDescription?: string;
  assetId?: string;
  loraType?: string;
  loraLink?: string;
  model?: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  thumbnailUrl?: string;
}

export interface VideoEntry {
  id: string;
  video_location: string;
  reviewer_name: string;
  skipped: boolean;
  created_at: string;
  admin_approved: string | null;
  user_id?: string;
  metadata?: VideoMetadata;
}

export interface RecordedVideo {
  id: string;
  blob: Blob;
  url: string;
  thumbnail?: string;
  metadata?: VideoMetadata;
}

export interface VideoFile {
  id?: string;
  blob?: Blob;
  url?: string;
  metadata?: VideoMetadata;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  video_upload_consent?: boolean;
}

export interface LoraAsset {
  id: string;
  name: string;
  description?: string;
  creator?: string;
  creatorDisplayName?: string;
  type: string;
  created_at: string;
  user_id?: string;
  primary_media_id?: string;
  admin_approved?: string | null;
  lora_type?: string;
  lora_link?: string;
  // Populated from related data
  primaryVideo?: VideoEntry;
  videos?: VideoEntry[];
}

// Props interfaces
export interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
  showExtras?: boolean;
  isMobile?: boolean;
}

