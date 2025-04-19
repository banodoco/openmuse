
import { UserAssetPreferenceStatus } from '@/components/lora/LoraCard';

export interface VideoMetadata {
  title: string;
  description?: string;
  creator?: 'self' | 'someone_else';
  creatorName?: string;
  classification?: 'art' | 'generation'; 
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
}

export type VideoDisplayStatus = 'Pinned' | 'View' | 'Hidden';

export interface VideoEntry {
  id: string;
  url: string;
  reviewer_name: string;
  skipped: boolean;
  created_at: string;
  admin_status?: string | null;
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
  lora_type?: string;
  lora_base_model?: string;
  model_variant?: string;
  lora_link?: string;
  primaryVideo?: VideoEntry;
  videos?: VideoEntry[];
  user_preference_status?: UserAssetPreferenceStatus | null;
}

export interface LoraManagerProps {
  loras: LoraAsset[];
  isLoading: boolean;
}

// Standard video metadata form interface to be used across components
export interface VideoMetadataForm {
  title: string;
  description: string;
  classification: 'art' | 'generation';
  creator: 'self' | 'someone_else';
  creatorName: string;
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
