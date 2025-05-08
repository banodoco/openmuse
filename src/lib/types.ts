import { UserAssetPreferenceStatus } from '@/components/lora/LoraCard';

export interface VideoMetadata {
  title: string;
  description: string;
  /** Optional display name of the creator (used in various UI components) */
  creatorName?: string;
  /** ID or identifier of the creator */
  creator?: string;
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

// Update AdminStatus to include 'Rejected'
export type AdminStatus = 'Listed' | 'Curated' | 'Featured' | 'Hidden' | 'Rejected';

// Define the user-settable display statuses
export type VideoDisplayStatus = 'Pinned' | 'Listed' | 'Hidden' | 'View';

export interface VideoEntry {
  id: string;
  url: string;
  reviewer_name: string;
  skipped: boolean;
  created_at: string;
  admin_status?: AdminStatus | null;
  user_status?: VideoDisplayStatus | null;
  assetMediaDisplayStatus?: VideoDisplayStatus | null;
  user_id?: string | null;
  metadata?: VideoMetadata;
  associatedAssetId?: string | null;
  placeholder_image?: string | null;
  is_primary?: boolean;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  admin_reviewed?: boolean;
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
  discord_user_id?: string;
  real_name?: string;
  avatar_url?: string;
  video_upload_consent?: boolean;
  description?: string;
  links?: string[];
  background_image_url?: string;
  discord_connected?: boolean;
}

export interface LoraAsset {
  id: string;
  name: string;
  description?: string | null;
  creator?: string | null;
  user_id?: string | null;
  created_at: string;
  primary_media_id?: string | null;
  primary_media_url?: string | null;
  primary_media_thumbnail_url?: string | null;
  admin_status?: string | null;
  user_status?: UserAssetPreferenceStatus | null;
  lora_type?: string | null;
  lora_base_model?: string | null;
  model_variant?: string | null;
  lora_link?: string | null;
  download_link?: string | null;
  admin_reviewed: boolean;
  type: 'lora';
  curator_id?: string | null;
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
}

export interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
}

export interface VideoMetadataForm {
  title: string;
  description: string;
  classification: 'art' | 'gen';
  isPrimary?: boolean;
}

export interface VideoItem {
  id: string;
  file: File | null;
  url: string | null;
  metadata: VideoMetadataForm;
  associatedLoraIds?: string[];
}

export type { UserAssetPreferenceStatus } from '@/components/lora/LoraCard';
