import { Logger } from '@/lib/logger';
import type { LoRADetails } from '@/pages/upload/UploadPage';
import type { VideoItem } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';

const logger = new Logger('HuggingFaceUploader');

// Interface for video metadata passed from UploadPage to this uploader
// when files are first uploaded to Supabase temporary storage.
export interface VideoItemClientUploadMetadata {
  storagePath?: string; // Path in Supabase 'temporary' bucket for new uploads
  existingUrl?: string; // URL if it's an existing video not being re-uploaded
  metadata: any; // Existing metadata structure from VideoItem
  originalFileName?: string; // To help map in edge function
}

interface HuggingFaceUploadOptions {
  // loraFile: File; // REMOVED - no longer sending file directly
  loraStoragePath: string; // NEW - path to LoRA file in Supabase temporary storage
  loraDetails: LoRADetails;
  // videos: VideoItem[]; // REMOVED
  videosMetadata: VideoItemClientUploadMetadata[]; // NEW - array of video metadata including their Supabase storage paths
  hfToken: string;
  repoName?: string;
  saveApiKey?: boolean;
}

// NEW: Define the expected response structure from the Edge Function
interface HuggingFaceUploadSuccessResponse {
  success: true;
  loraUrl: string;
  videoUrls: string[];
}

// Update the return type of the function
export async function uploadLoraToHuggingFace({
  loraStoragePath, 
  loraDetails,
  videosMetadata, 
  hfToken,
  repoName,
  saveApiKey = false,
// The Promise should resolve to the new object structure on success, or null/error
}: HuggingFaceUploadOptions): Promise<HuggingFaceUploadSuccessResponse | null> {
  if (!hfToken) {
    logger.error('HuggingFace token is missing.');
    throw new Error('HuggingFace token is required for upload.');
  }

  // Store the API key in Supabase only if saveApiKey is true
  if (saveApiKey) {
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(); // Get user first

    if (getUserError || !user) {
      logger.error('User not authenticated or error fetching user, cannot save API key.', getUserError);
      throw new Error('User not authenticated or error fetching user, cannot save API key.');
    }

    logger.log('Attempting to save API key for user:', user.id);
    const { error: apiKeyError } = await supabase
      .from('api_keys')
      .upsert({
        user_id: user.id,
        service: 'huggingface',
        key_value: hfToken,
        updated_at: new Date().toISOString(), // Keep updated_at consistent
      }, {
        onConflict: 'user_id,service'
      });

    if (apiKeyError) {
      logger.error('Failed to store HuggingFace API key:', apiKeyError);
      console.error('Supabase apiKeyError details:', apiKeyError); 
      throw new Error('Failed to store HuggingFace API key securely.');
    }
    logger.log('API key stored successfully for user:', user.id);
  }

  // Call the secure endpoint
  // Construct FormData
  const formData = new FormData();
  // formData.append('loraFile', loraFile, loraFile.name); // REMOVED
  formData.append('loraStoragePath', loraStoragePath); // NEW
  formData.append('loraDetails', JSON.stringify(loraDetails));
  
  // The client now sends 'videosMetadata' which includes storagePath or existingUrl
  // The old 'videos.forEach' loop that appended actual files is no longer needed here,
  // as files are already in Supabase storage by the time this function is called.
  formData.append('videosMetadata', JSON.stringify(videosMetadata)); // videosMetadata now contains storage paths

  if (repoName) {
    formData.append('repoName', repoName);
  }

  const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
  if (!accessToken) {
    throw new Error('User not authenticated, cannot get access token.');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/huggingface-upload`, {
    method: 'POST',
    headers: {
      // 'Content-Type': 'multipart/form-data' // fetch will set this automatically with boundary
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData, // Use FormData object as body
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload to HuggingFace');
  }

  // Parse the response assuming it matches the new structure
  const result: HuggingFaceUploadSuccessResponse = await response.json();
  
  // Basic validation of the response structure
  if (!result || result.success !== true || !result.loraUrl) {
    logger.error('Invalid success response structure from Edge Function:', result);
    throw new Error('Received an invalid response from the Hugging Face upload function.');
  }
  
  // Ensure videoUrls is an array, even if empty
  result.videoUrls = result.videoUrls || []; 

  return result;
}

function sanitizeRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-._]/g, '') // Remove invalid characters
    .replace(/--+/g, '-') // Replace multiple hyphens with a single one
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
}

function generateReadmeContent(loraDetails: LoRADetails, videos: VideoItem[], uploadedVideoPaths: string[], loraFileName: string, repoId: string): string {
  const loraFilePathInRepo = loraFileName; // Assumes loraFile is at the root
  let readme = "";

  // YAML Frontmatter
  readme += "---\n";
  readme += "base_model:\n";
  // TODO: Make base_model dynamic if necessary, e.g., from loraDetails.model or a mapping
  readme += "- Lightricks/LTX-Video\n"; // As per user example
  readme += "tags:\n";
  readme += "- ltxv\n"; // As per user example
  readme += "- 13B\n"; // As per user example
  readme += "- text-to-video\n"; // As per user example
  readme += "- lora\n";
  if (loraDetails.model) {
    readme += `- ${loraDetails.model.toLowerCase().replace(/\s+/g, '-')}\n`;
  }
  if (loraDetails.loraType) {
    readme += `- ${loraDetails.loraType.toLowerCase().replace(/\s+/g, '-')}\n`;
  }
  readme += "library_name: diffusers\n"; // Common for LoRAs

  // Widget section for videos
  if (uploadedVideoPaths && uploadedVideoPaths.length > 0) {
    readme += "widget:\n";
    uploadedVideoPaths.forEach(videoPathInRepo => {
      const videoFileName = videoPathInRepo.split('/').pop();
      const videoItem = videos.find(v => v.file && v.file.name === videoFileName);
      if (videoItem && videoItem.metadata.description) {
        // Ensure description is formatted nicely for YAML multi-line string using >-
        // Remove existing newlines from description and replace double quotes to avoid breaking YAML
        const promptText = videoItem.metadata.description.replace(/\n/g, ' ').replace(/\"/g, '\\"');
        readme += `- text: >-\n`;
        readme += `    "${promptText}"\n`; // Indentation is important for YAML
        readme += `  output:\n`;
        readme += `    url: ${videoPathInRepo}\n`; // Path relative to repo root
      }
    });
  }
  readme += "---\n\n";

  // Rest of the README content
  readme += `# ${loraDetails.loraName || 'Unnamed LoRA'}\n\n`;
  readme += `This LoRA was uploaded via OpenMuse.ai: [https://openmuse.ai/](https://openmuse.ai/)\n\n`;
  readme += `## Model Details\n\n`;
  readme += `**File:** \`./${loraFilePathInRepo}\` ([Download Link](https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(loraFilePathInRepo)}))\n\n`;
  readme += `**Base Model:** ${loraDetails.model || 'N/A'} (${loraDetails.modelVariant || 'N/A'})\n`;
  readme += `**LoRA Type:** ${loraDetails.loraType || 'N/A'}\n\n`;
  readme += `### Trigger Words & Usage Notes\n`;
  readme += "```text\n";
  readme += `${loraDetails.loraDescription || 'No specific trigger words or usage notes provided.'}\n`;
  readme += "```\n\n";

  if (loraDetails.creator === 'someone_else' && loraDetails.creatorName) {
    readme += `## Creator Information\n`;
    readme += `Originally created by: **${loraDetails.creatorName}**\n\n`;
  }

  // Adjusted Example Media section to avoid redundancy if widget is present,
  // but still useful to list them with direct links if widget isn't fully comprehensive
  // or for non-widget UIs.
  if (uploadedVideoPaths && uploadedVideoPaths.length > 0) {
    readme += `## Example Media Files\n`;
    readme += `The following media files were uploaded as examples for this LoRA:\n\n`;
    uploadedVideoPaths.forEach((videoPath, index) => {
      const videoFileName = videoPath.split('/').pop() || `Example Video ${index + 1}`;
      // Link to the file within the repo (Hugging Face UI will handle display)
      // and a direct download link.
      readme += `* **${videoFileName}**: [View Media](./${videoPath}) or [Download](https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(videoPath)})\n`;
    });
    readme += `\n`;
  }

  return readme;
}

// Ensure LoRADetails and VideoItem types are correctly imported based on your project structure.
// Example for LoRADetails if it's in UploadPage.tsx:
// import type { LoRADetails } from \'../../pages/upload/UploadPage\'; 
// If VideoItem is in src/lib/types.ts
// import type { VideoItem } from \'../types\'; 