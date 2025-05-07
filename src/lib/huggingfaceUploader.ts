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

    const readmeContent = generateReadmeContent(loraDetails, videos, loraFile.name, repoId);
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
    if (error.message?.includes('authentication failed') || error.status === 401) {
        throw new Error('HuggingFace authentication failed. Please check your API key.');
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

function generateReadmeContent(loraDetails: LoRADetails, videos: VideoItem[], loraFileName: string, repoId: string): string {
  // Determine how to link to the file.
  // For files in the root of a model repo, it's usually just the filename.
  // If you decide to put it in a subfolder e.g. "models/", it would be "models/yourfile.safetensors"
  const loraFilePathInRepo = loraFileName; 

  let readme = `---
license: mit 
tags:
- lora
- ${loraDetails.model || 'unknown-model'}
- ${loraDetails.loraType?.toLowerCase().replace(' ', '-') || 'unknown-type'}
library_name: diffusers
---

# ${loraDetails.loraName || 'Unnamed LoRA'}

This LoRA was uploaded via [OpenMuse](https://app.openmuse.ai). 

## Model Details

**File:** \`./${loraFilePathInRepo}\` ([Download Link](https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(loraFilePathInRepo)}))

**Base Model:** ${loraDetails.model || 'N/A'} (${loraDetails.modelVariant || 'N/A'})
**LoRA Type:** ${loraDetails.loraType || 'N/A'}

### Trigger Words & Usage Notes
\`\`\`text
${loraDetails.loraDescription || 'No specific trigger words or usage notes provided.'}
\`\`\`

`;

  if (loraDetails.creator === 'someone_else' && loraDetails.creatorName) {
    readme += `## Creator Information\n`;
    readme += `Originally created by: **${loraDetails.creatorName}**\n`;
    // Assuming loraDetails.creatorOrigin might be added in the future
    // if (loraDetails.creatorOrigin) { 
    //    readme += `Creator Origin/Profile: ${loraDetails.creatorOrigin}\n`;
    // }
  } else if (loraDetails.creator === 'self') {
    readme += `## Creator Information\n`;
    readme += `Uploaded by the original creator.\n`;
  }
  
  if (videos && videos.length > 0) {
    readme += `\n## Example Media\n`;
    readme += `The following media were generated or provided as examples for this LoRA:\n\n`;
    videos.forEach((video, index) => {
      if (video.url) {
        const title = video.metadata?.title || `Example Video ${index + 1}`;
        readme += `* **${title}**: [View Media](${video.url})\n`;
      }
    });
  }

  return readme;
}

// Ensure LoRADetails and VideoItem types are correctly imported based on your project structure.
// Example for LoRADetails if it's in UploadPage.tsx:
// import type { LoRADetails } from '../../pages/upload/UploadPage'; 
// If VideoItem is in src/lib/types.ts
// import type { VideoItem } from '../types'; 