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
  model?: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';  // This is the base model
  modelVariant?: string;  // New field for model variant
  baseModel?: string;
  placeholder_image?: string;
  trainingSteps?: string | number;
  resolution?: string;
  trainingDataset?: string;
}

export interface VideoEntry {
  id: string;
  url: string;
  reviewer_name: string;
  skipped: boolean;
  created_at: string;
  admin_approved: string | null;
  user_id?: string;
  metadata?: VideoMetadata;
  lora_identifier?: string | null;
  placeholder_image?: string | null;
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
  admin_approved?: string | null;
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
