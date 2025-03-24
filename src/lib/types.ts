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
