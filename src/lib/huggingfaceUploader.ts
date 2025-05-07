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

    const readmeContent = generateReadmeContent(loraDetails, uploadedVideoPaths, loraFile.name, repoId);
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
  if (!name || name.trim() === '') return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-._]/g, '')
    .substring(0, 96) // Max repo name length on HF is often around 96 chars for user/org + repo
    .replace(/--+/g, '-');
}

function generateReadmeContent(loraDetails: LoRADetails, uploadedVideoPaths: string[], loraFileName: string, repoId: string): string {
  const loraFilePathInRepo = loraFileName;
  let readme = "";
  readme += `---\n`;
  readme += `license: mit\n`;
  readme += `tags:\n`;
  readme += `- lora\n`;
  readme += `- ${loraDetails.model || 'unknown-model'}\n`;
  readme += `- ${loraDetails.loraType ? loraDetails.loraType.toLowerCase().replace(/\s+/g, '-') : 'unknown-type'}\n`;
  readme += `library_name: diffusers\n`;
  readme += `---\n\n`;
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

  if (uploadedVideoPaths && uploadedVideoPaths.length > 0) {
    readme += `## Example Media\n`;
    readme += `The following media were generated or provided as examples for this LoRA:\n\n`;
    uploadedVideoPaths.forEach((videoPath, index) => {
      const videoFileName = videoPath.split('/').pop() || `Example Video ${index + 1}`;
      readme += `* **${videoFileName}**: [View Media](./${videoPath}) or [Download](https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(videoPath)})\n`;
    });
  }

  return readme;
}

// Ensure LoRADetails and VideoItem types are correctly imported based on your project structure.
// Example for LoRADetails if it's in UploadPage.tsx:
// import type { LoRADetails } from \'../../pages/upload/UploadPage\'; 
// If VideoItem is in src/lib/types.ts
// import type { VideoItem } from \'../types\'; 