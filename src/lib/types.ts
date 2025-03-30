
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
  loraType?: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Control' | 'Other';
  loraLink?: string;
  model?: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  baseModel?: string;
  thumbnailUrl?: string;
  trainingSteps?: string | number;
  resolution?: string;
  trainingDataset?: string;
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
  lora_base_model?: string;  // Add this to distinguish base model
  lora_link?: string;
  // Populated from related data
  primaryVideo?: VideoEntry;
  videos?: VideoEntry[];
}
