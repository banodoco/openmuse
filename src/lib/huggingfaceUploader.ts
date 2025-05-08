import {
  whoAmI,       // Corrected casing
  createRepo,
  uploadFile,
} from '@huggingface/hub';
import { Logger } from '@/lib/logger';
import type { LoRADetails } from '@/pages/upload/UploadPage'; // Adjust path if LoRADetails is defined elsewhere or globally
import type { VideoItem } from '@/lib/types'; 

const logger = new Logger('HuggingFaceUploader');

interface HuggingFaceUploadOptions {
  loraFile: File;
  loraDetails: LoRADetails;
  videos: VideoItem[]; 
  hfToken: string; 
  repoName?: string; 
}

export async function uploadLoraToHuggingFace({
  loraFile,
  loraDetails,
  videos,
  hfToken,
  repoName,
}: HuggingFaceUploadOptions): Promise<string | null> {
  if (!hfToken) {
    logger.error('HuggingFace token is missing.');
    throw new Error('HuggingFace token is required for upload.');
  }

  let username: string;
  try {
    const hfUser = await whoAmI({ credentials: { accessToken: hfToken } }); 
    if (!hfUser.name) {
        logger.error('Could not determine HuggingFace username from token.');
        throw new Error('Could not determine HuggingFace username.');
    }
    username = hfUser.name;
  } catch (err: any) {
    logger.error('Error fetching HuggingFace user info (whoAmI):', err);
    throw new Error(`Failed to authenticate with HuggingFace: ${err.message}`);
  }
  
  const finalRepoName = repoName || sanitizeRepoName(loraDetails.loraName) || `unnamed-lora-${Date.now()}`;
  const repoId = `${username}/${finalRepoName}`;

  try {
    logger.log(`Ensuring HuggingFace repo exists (or creating if not): ${repoId}`);
    try {
      await createRepo({
        repo: repoId,
        private: false, 
        credentials: { accessToken: hfToken }
      }); 
      logger.log(`Repository ${repoId} created successfully.`);
    } catch (error: any) {
      if (error.message && error.message.toLowerCase().includes('already exists')) {
        logger.log(`Repository ${repoId} already exists, continuing.`);
      } else {
        throw error;
      }
    }

    logger.log(`Uploading LoRA file: ${loraFile.name} to ${repoId}`);
    await uploadFile({
      repo: repoId,
      file: loraFile,
      credentials: { accessToken: hfToken },
    });
    logger.log(`LoRA file ${loraFile.name} uploaded successfully.`);

    // Upload up to 3 videos to a 'media' folder
    const uploadedVideoPaths: string[] = [];
    if (videos && videos.length > 0) {
      logger.log(`Uploading example media to ${repoId}/media/`);
      for (let i = 0; i < Math.min(videos.length, 3); i++) {
        const videoItem = videos[i];
        if (videoItem.file && videoItem.file instanceof File) {
          try {
            const videoFileName = videoItem.file.name;
            const targetPathInRepo = `media/${videoFileName}`;
            logger.log(`Uploading ${videoFileName} to ${targetPathInRepo}...`);
            await uploadFile({
              repo: repoId,
              file: { path: targetPathInRepo, content: videoItem.file },
              credentials: { accessToken: hfToken },
            });
            uploadedVideoPaths.push(targetPathInRepo);
            logger.log(`${videoFileName} uploaded successfully to ${targetPathInRepo}.`);
          } catch (videoUploadError: any) {
            logger.error(`Failed to upload video ${videoItem.file.name}:`, videoUploadError);
            // Decide if you want to throw, or just log and continue
          }
        }
      }
    }

    const readmeContent = generateReadmeContent(loraDetails, videos, uploadedVideoPaths, loraFile.name, repoId);
    logger.log(`Uploading README.md to ${repoId}`);
    const readmeBlob = new Blob([readmeContent], { type: 'text/markdown' });
    const readmeFile = new File([readmeBlob], 'README.md', { type: 'text/markdown' });
    await uploadFile({
      repo: repoId,
      file: readmeFile,
      credentials: { accessToken: hfToken },
    });
    logger.log('README.md uploaded successfully.');

    const loraFileUrl = `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(loraFile.name)}`;
    logger.log(`LoRA accessible at: ${loraFileUrl}`);
    return loraFileUrl;

  } catch (error: any) {
    logger.error(`Error during HuggingFace upload process for ${repoId}:`, error);
    if (error.message?.includes('authentication failed') || error.status === 401 || (error.response && error.response.status === 401)) {
        throw new Error('HuggingFace authentication failed. Please check your API key and its permissions.');
    } else if (error.message?.includes('You don\'t have the rights') || error.status === 403 || (error.response && error.response.status === 403)) {
        throw new Error('HuggingFace permission error: Your API key may not have write access to create repositories. Please check its permissions on huggingface.co/settings/tokens.');
    }
    throw new Error(`Failed to upload to HuggingFace: ${error.message || 'Unknown error'}`);
  }
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