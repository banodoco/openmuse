export interface VideoMetadata {
  title: string;
  description?: string;
  creator?: 'self' | 'someone_else';  // Changed from required to optional
  creatorName?: string;
  classification?: 'art' | 'gen' | string;
  url?: string;
  model?: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  // LoRA details
  loraName?: string;
  loraDescription?: string;
  loraType?: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Other';
  loraLink?: string;
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
  admin_approved: string | null;
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

export interface LoraAsset {
  id: string;
  name: string;
  description?: string;
  creator?: string;
  type: string;
  created_at: string;
  user_id?: string;
  primary_media_id?: string;
  admin_approved?: string | null; // Changed from boolean to string to support "Curated", "Listed", "Rejected"
  // Removed references to lora_type and lora_link here
  // Populated from related data
  primaryVideo?: VideoEntry;
  videos?: VideoEntry[];
}
