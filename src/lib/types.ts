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
  // Optional metadata fields for Cloudflare integration
  cloudflareUid?: string;
}

// Update AdminStatus to include 'Rejected'
export type AdminStatus = 'Listed' | 'Curated' | 'Featured' | 'Hidden' | 'Rejected';

// Define the user-settable display statuses
export type VideoDisplayStatus = 'Pinned' | 'Listed' | 'Hidden';

// User preference for their own assets
export type UserAssetPreferenceStatus = 'Pinned' | 'Listed' | 'Hidden';

export interface VideoEntry {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: string;
  url: string;
  // New fields for Cloudflare Stream integration
  cloudflare_stream_uid?: string;
  cloudflare_thumbnail_url?: string;
  cloudflare_playback_hls_url?: string;
  cloudflare_playback_dash_url?: string;
  storage_provider: 'cloudflare-stream' | string;
  metadata?: VideoMetadata;
  placeholder_image?: string;
  classification?: string;
  asset_id?: string;
  // Additional fields such as created_at, updated_at can be added here if needed
  reviewer_name: string;
  skipped: boolean;
  created_at: string;
  admin_status?: AdminStatus | null;
  user_status?: VideoDisplayStatus | null;
  assetMediaDisplayStatus?: VideoDisplayStatus | null;
  associatedAssetId?: string | null;
  is_primary?: boolean;
  thumbnailUrl?: string;
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

export type AssetType = 'lora' | 'workflow';

export interface BaseAsset {
  id: string;
  name: string;
  description?: string | null;
  creator?: string | null; // Display name of the creator
  user_id?: string | null; // UUID of the user who owns/uploaded this asset
  curator_id?: string | null; // UUID of the user who curated this (if different from owner)
  created_at: string;
  type: AssetType;
  admin_status?: AdminStatus | null;
  user_status?: UserAssetPreferenceStatus | null;
  admin_reviewed: boolean;
  primary_media_id?: string | null;
  download_link?: string | null;
  primaryVideo?: VideoEntry; // For preview/display
  videos?: VideoEntry[]; // Associated example/showcase videos
}

export interface LoraAsset extends BaseAsset {
  type: 'lora';
  lora_type?: string | null;
  lora_base_model?: string | null;
  model_variant?: string | null;
  lora_link?: string | null; // Link to original source if not uploaded directly (e.g. CivitAI, HuggingFace page)
  // download_link is inherited from BaseAsset, can be direct model download if not using HF repo via lora_link
}

export interface WorkflowAsset extends BaseAsset {
  type: 'workflow';
  // download_link is inherited from BaseAsset and will point to the Supabase storage URL for the workflow file.
  // Add optional model fields, assuming they might be stored in the same DB columns as LoRAs
  lora_base_model?: string | null;
  model_variant?: string | null;
  // We might add workflow_format (e.g., "ComfyUI JSON", "InvokeAI YAML") later if needed.
}

export type AnyAsset = LoraAsset | WorkflowAsset;

export interface AssetManagerProps {
  assets: AnyAsset[];
  isLoading: boolean;
  // Add other relevant props for managing assets, e.g., isAdmin, event handlers
  // This replaces LoraManagerProps
  // Props like onFilterTextChange, filterText, onRefreshData will be needed
  // Props for admin actions like onAdminStatusChange
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
