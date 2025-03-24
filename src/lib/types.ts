
export interface VideoFile {
  id: string;
  blob: Blob;
  metadata?: any;
}

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
  baseModel?: string;
  trainingSteps?: string;
  resolution?: string;
  trainingDataset?: string;
}

export interface VideoEntry {
  id: string;
  video_location: string;
  reviewer_name: string;
  skipped: boolean;
  admin_approved: boolean;
  created_at: string;
  user_id?: string | null;
  metadata?: VideoMetadata | null;
}

export interface RecordedVideo {
  blob: Blob;
  url: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  email?: string;
  avatar_url?: string;
  created_at?: string;
}
