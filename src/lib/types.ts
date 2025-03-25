
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
}
