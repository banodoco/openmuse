export interface VideoMetadata {
  title: string;
  description?: string;
  creator?: 'self' | 'someone_else';
  creatorName?: string;
  classification?: 'art' | 'generation'; // Enforce allowed values
  isPrimary?: boolean;
  loraName?: string;
  loraDescription?: string;
  assetId?: string;
  loraType?: string;
  loraLink?: string;
  model?: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';  // This is the base model
  modelVariant?: string;  // New field for model variant
  baseModel?: string;
  placeholder_image?: string;
  trainingSteps?: string | number;
  resolution?: string;
  trainingDataset?: string;
}

// Define the status types matching VideoStatusControls
// Use the same status names for both contexts
// Export this type so it can be imported elsewhere
export type VideoDisplayStatus = 'Pinned' | 'View' | 'Hidden';

export interface VideoEntry {
  id: string;
  url: string;
  reviewer_name: string;
  skipped: boolean;
  created_at: string;
  admin_status?: string | null; // e.g., 'Curated', 'Rejected'
  // Use the unified status type for both fields
  assetMediaDisplayStatus?: VideoDisplayStatus | null; // Status for asset page (from asset_media.status)
  user_status?: VideoDisplayStatus | null; // Status for user profile page (from media.user_status)
  user_id?: string | null;
  metadata?: VideoMetadata; // Should contain fields like title, description, classification
  associatedAssetId?: string | null; // ID of the LoRA asset this video is linked to
  placeholder_image?: string | null;
  is_primary?: boolean; // Is this the primary video for an asset?
  // Redundant fields? Consider removing if always available in metadata
  thumbnailUrl?: string; // Often same as placeholder_image
  title?: string; // Usually in metadata.title
  description?: string; // Usually in metadata.description
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
  discord_username?: string;
  real_name?: string;
  avatar_url?: string;
  video_upload_consent?: boolean;
  description?: string;
  links?: string[];
  background_image_url?: string;
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
  admin_status?: string | null;
  user_status?: string | null;
  lora_type?: string;  // LoRA type (Concept, Motion Style, etc)
  lora_base_model?: string;  // Base model (wan, hunyuan, etc)
  model_variant?: string;  // New field for model variant
  lora_link?: string;
  // Populated from related data
  primaryVideo?: VideoEntry;
  videos?: VideoEntry[];
}

// Props interfaces
export interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
}
