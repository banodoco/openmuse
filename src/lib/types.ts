import { UserAssetPreferenceStatus } from '@/components/lora/LoraCard';

export interface VideoMetadata {
  title: string;
  description: string;
  /** Optional display name of the creator (used in various UI components) */
  creatorName?: string;
  classification: 'art' | 'gen';
  isPrimary?: boolean;
  loraName?: string;
  loraDescription?: string;
  assetId?: string;
  loraType?: string;
  loraLink?: string;
  model?: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  modelVariant?: string;
  baseModel?: string;
  placeholder_image?: string;
  trainingSteps?: string | number;
  resolution?: string;
  trainingDataset?: string;
  aspectRatio?: number;
  associatedLoraIds?: string[];
}

export type VideoDisplayStatus = 'Pinned' | 'View' | 'Hidden';

// Update AdminStatus to include 'Rejected'
export type AdminStatus = 'Listed' | 'Curated' | 'Featured' | 'Hidden' | 'Rejected';

export type AssetType = 'lora' | 'other'; // Example, adjust as needed

export interface VideoEntry {
  id: string;
  url: string;
  reviewer_name: string;
  skipped: boolean;
  created_at: string;
  admin_status?: AdminStatus | null; // Use the new AdminStatus type
  assetMediaDisplayStatus?: VideoDisplayStatus | null;
  user_status?: VideoDisplayStatus | null;
  user_id?: string | null;
  metadata?: VideoMetadata;
  associatedAssetId?: string | null;
  placeholder_image?: string | null;
  is_primary?: boolean;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  admin_reviewed?: boolean;  // Add optional boolean field
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
  discord_username?: string; // Added
  discord_user_id?: string;  // Added
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
  admin_status?: AdminStatus | null;
  user_status?: UserAssetPreferenceStatus | null;
  lora_type?: string;
  lora_base_model?: string;
  model_variant?: string;
  lora_link?: string;
  primaryVideo?: VideoEntry;
  videos?: VideoEntry[];
  user_preference_status?: UserAssetPreferenceStatus | null;
  associatedThumbnails?: (string | null)[];
  associatedMedia?: Array<{
    id: string;
    url?: string;
    thumbnailUrl?: string;
    title?: string;
  }>;
  admin_reviewed?: boolean;  // Add optional boolean field
}

export interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
}

// Standard video metadata form interface to be used across components
export interface VideoMetadataForm {
  title: string;
  description: string
  classification: 'art' | 'gen';
  isPrimary?: boolean;
}

// Standard video item interface to be used across components
export interface VideoItem {
  id: string;
  file: File | null;
  url: string | null;
  metadata: VideoMetadataForm;
  associatedLoraIds?: string[];
}

export type { UserAssetPreferenceStatus } from '@/components/lora/LoraCard';
