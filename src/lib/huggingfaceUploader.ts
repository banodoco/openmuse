import { Logger } from '@/lib/logger';
import type { LoRADetails } from '@/pages/upload/UploadPage';
import type { VideoItem } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';

const logger = new Logger('HuggingFaceUploader');

interface HuggingFaceUploadOptions {
  loraFile: File;
  loraDetails: LoRADetails;
  videos: VideoItem[];
  hfToken: string;
  repoName?: string;
  saveApiKey?: boolean;
}

export async function uploadLoraToHuggingFace({
  loraFile,
  loraDetails,
  videos,
  hfToken,
  repoName,
  saveApiKey = false,
}: HuggingFaceUploadOptions): Promise<string | null> {
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
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/huggingface-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
    body: JSON.stringify({
      loraFile,
      loraDetails,
      videos,
      repoName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload to HuggingFace');
  }

  const result = await response.json();
  return result.url;
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