
export interface LoraAsset {
  id: string;
  name: string;
  description?: string;
  creator?: string;
  type: string;
  created_at: string;
  user_id?: string;
  primary_media_id?: string;
  admin_approved?: string | null;
  lora_type?: string;  // Restored
  lora_link?: string;  // Restored
  // Populated from related data
  primaryVideo?: VideoEntry;
  videos?: VideoEntry[];
}
