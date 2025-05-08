import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { whoAmI, createRepo, uploadFile } from 'https://esm.sh/@huggingface/hub@0.1.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user's session
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get the user's Hugging Face API key
    const { data: apiKeyData, error: apiKeyError } = await supabaseClient
      .from('api_keys')
      .select('key_value')
      .eq('user_id', user.id)
      .eq('service', 'huggingface')
      .single()

    if (apiKeyError || !apiKeyData) {
      throw new Error('Hugging Face API key not found')
    }

    const hfToken = apiKeyData.key_value

    // Get the request body by parsing FormData
    const formData = await req.formData();
    const loraStoragePath = formData.get('loraStoragePath') as string | null;
    const loraDetailsRaw = formData.get('loraDetails') as string | null;
    const videosMetadataRaw = formData.get('videosMetadata') as string | null;
    const repoNameFromData = formData.get('repoName') as string | null; // Optional

    if (!loraStoragePath) {
      throw new Error('LoRA storage path not found in form data');
    }
    if (!loraDetailsRaw) {
      throw new Error('LoRA details not found in form data');
    }
    if (!videosMetadataRaw) {
      throw new Error('Videos metadata not found in form data');
    }

    const loraDetails = JSON.parse(loraDetailsRaw);
    const videosMetadata = JSON.parse(videosMetadataRaw);
    const repoName = repoNameFromData || sanitizeRepoName(loraDetails.loraName) || `unnamed-lora-${Date.now()}`; 

    // --- Download LoRA from Supabase Temporary Storage ---
    console.log(`Downloading LoRA from Supabase storage: ${loraStoragePath}`);
    const { data: loraBlob, error: loraDownloadError } = await supabaseClient.storage
      .from('temporary') // Your temporary bucket name
      .download(loraStoragePath);

    if (loraDownloadError) {
      console.error('Error downloading LoRA from Supabase storage:', loraDownloadError);
      throw new Error(`Failed to download LoRA from temporary storage: ${loraDownloadError.message}`);
    }
    if (!loraBlob) {
      throw new Error('Downloaded LoRA blob is null.');
    }
    // Extract original filename. Assume it's the last part of the path after the UUID.
    const loraOriginalName = loraStoragePath.split('-').pop() || 'lora-file.safetensors';
    const loraFileForHf = new File([loraBlob], loraOriginalName, { type: loraBlob.type });
    console.log(`LoRA file ${loraFileForHf.name} (size: ${loraFileForHf.size}) prepared for Hugging Face upload.`);
    // --- End Download LoRA ---

    // Upload to Hugging Face
    const hfUser = await whoAmI({ credentials: { accessToken: hfToken } })
    if (!hfUser.name) {
      throw new Error('Could not determine HuggingFace username')
    }

    const username = hfUser.name
    const repoId = `${username}/${repoName}`

    // Create or ensure repo exists
    try {
      await createRepo({
        repo: repoId,
        private: false,
        credentials: { accessToken: hfToken }
      })
      console.log(`Repository ${repoId} created or already exists.`);
    } catch (error: any) {
      if (!error.message?.toLowerCase().includes('already exists')) {
        console.error(`Error creating repo ${repoId}:`, error);
        throw error // Re-throw if it's not an 'already exists' error
      }
      console.log(`Repository ${repoId} already exists, proceeding.`);
    }

    // Upload LoRA file
    console.log(`Uploading LoRA file ${loraFileForHf.name} to ${repoId}`);
    await uploadFile({
      repo: repoId,
      file: loraFileForHf, // Use the downloaded and File-converted blob
      credentials: { accessToken: hfToken },
    })
    console.log(`LoRA file ${loraFileForHf.name} uploaded successfully.`);

    // Upload videos if any
    const uploadedVideoPaths: string[] = []
    const successfullyDownloadedTempVideoPaths: string[] = [] // For cleanup

    if (videosMetadata && Array.isArray(videosMetadata) && videosMetadata.length > 0) {
      console.log(`Processing ${videosMetadata.length} video metadata entries for file uploads.`);
      for (let i = 0; i < videosMetadata.length; i++) {
        const videoMeta = videosMetadata[i];
        if (videoMeta.storagePath && videoMeta.originalFileName) {
          console.log(`Processing video from storage path: ${videoMeta.storagePath}`);
          try {
            const { data: videoBlob, error: videoDownloadError } = await supabaseClient.storage
              .from('temporary') // Your temporary bucket name
              .download(videoMeta.storagePath);

            if (videoDownloadError) {
              console.error(`Error downloading video ${videoMeta.originalFileName} from Supabase storage:`, videoDownloadError);
              throw new Error(`Failed to download video ${videoMeta.originalFileName}: ${videoDownloadError.message}`);
            }
            if (!videoBlob) {
              throw new Error(`Downloaded video blob is null for ${videoMeta.originalFileName}.`);
            }
            successfullyDownloadedTempVideoPaths.push(videoMeta.storagePath); // Add for cleanup

            const videoFileForHf = new File([videoBlob], videoMeta.originalFileName, { type: videoBlob.type });
            const videoFileNameInRepo = sanitizeRepoName(videoFileForHf.name);
            const targetPathInRepo = `media/${videoFileNameInRepo}`;

            console.log(`Uploading video file ${videoFileForHf.name} (size: ${videoFileForHf.size}) to ${targetPathInRepo} in ${repoId}`);
            await uploadFile({
              repo: repoId,
              file: { path: targetPathInRepo, content: videoFileForHf },
              credentials: { accessToken: hfToken },
            });
            uploadedVideoPaths.push(targetPathInRepo);
            console.log(`Video ${videoFileForHf.name} uploaded successfully to ${targetPathInRepo}.`);

          } catch (videoProcessingError: any) {
            console.error(`Failed to process/upload video ${videoMeta.originalFileName}:`, videoProcessingError);
            // Decide if one video failing should stop all, for now, it logs and continues to next video
          }
        } else if (videoMeta.existingUrl) {
          console.log(`Skipping file processing for existing video URL: ${videoMeta.existingUrl}`);
          // If you want existing URLs to be in the README widget, you might need to add them to uploadedVideoPaths or handle separately
        }
      }
    } else {
      console.log('No video metadata or empty videos metadata array found.');
    }

    // Generate and upload README
    const loraFileNameForReadme = loraFileForHf.name; // Use name from the File object created from blob
    console.log(`Generating README with LoRA file name: ${loraFileNameForReadme} and ${uploadedVideoPaths.length} uploaded videos.`);
    const readmeContent = generateReadmeContent(loraDetails, videosMetadata, uploadedVideoPaths, loraFileNameForReadme, repoId)
    const readmeBlob = new Blob([readmeContent], { type: 'text/markdown' })
    const readmeFile = new File([readmeBlob], 'README.md', { type: 'text/markdown' })
    await uploadFile({
      repo: repoId,
      file: readmeFile,
      credentials: { accessToken: hfToken },
    })

    // Construct final URLs
    const loraFileUrl = `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(loraFileForHf.name)}` // Use name from downloaded file
    const uploadedVideoHfUrls: string[] = uploadedVideoPaths.map(videoPath => 
      `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(videoPath)}`
    );
    console.log('Constructed final video URLs:', uploadedVideoHfUrls);

    // --- Cleanup temporary files from Supabase Storage ---
    const pathsToClean: string[] = [];
    if (loraStoragePath) pathsToClean.push(loraStoragePath);
    pathsToClean.push(...successfullyDownloadedTempVideoPaths);

    if (pathsToClean.length > 0) {
      console.log('Cleaning up temporary files from Supabase storage:', pathsToClean);
      const { error: cleanupError } = await supabaseClient.storage
        .from('temporary')
        .remove(pathsToClean);
      if (cleanupError) {
        console.error('Error cleaning up temporary files:', cleanupError);
        // Non-fatal, log and continue
      } else {
        console.log('Temporary files cleaned up successfully.');
      }
    }
    // --- End Cleanup ---

    return new Response(
      JSON.stringify({ 
        success: true, 
        loraUrl: loraFileUrl, 
        videoUrls: uploadedVideoHfUrls 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[HUGGINGFACE_UPLOAD_ERROR]', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred in the Edge Function.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

function sanitizeRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-._]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generateReadmeContent(loraDetails: any, videosMetadata: any[], uploadedVideoPaths: string[], loraFileName: string, repoId: string): string {
  let readme = ""

  // YAML Frontmatter
  readme += "---\n"
  readme += "base_model:\n"
  readme += "- Lightricks/LTX-Video\n"
  readme += "tags:\n"
  readme += "- ltxv\n"
  readme += "- 13B\n"
  readme += "- text-to-video\n"
  readme += "- lora\n"
  if (loraDetails.model) {
    readme += `- ${loraDetails.model.toLowerCase().replace(/\s+/g, '-')}\n`
  }
  if (loraDetails.loraType) {
    readme += `- ${loraDetails.loraType.toLowerCase().replace(/\s+/g, '-')}\n`
  }
  readme += "library_name: diffusers\n"

  // Widget section for videos
  if (uploadedVideoPaths && uploadedVideoPaths.length > 0) {
    readme += "widget:\n"
    uploadedVideoPaths.forEach(videoPathInRepo => {
      const videoFileNameFromPath = videoPathInRepo.split('/').pop();
      const videoMetaItem = videosMetadata.find(vm => vm.originalFileName && sanitizeRepoName(vm.originalFileName) === videoFileNameFromPath);

      if (videoMetaItem && videoMetaItem.metadata && videoMetaItem.metadata.description) {
        const promptText = videoMetaItem.metadata.description.replace(/\n/g, ' ').replace(/\"/g, '\\"');
        readme += `- text: >-\n`
        readme += `    "${promptText}"\n`
        readme += `  output:\n`
        readme += `    url: ${videoPathInRepo}\n`
      }
    })
  }
  readme += "---\n\n"

  // Rest of the README content
  readme += `# ${loraDetails.loraName || 'Unnamed LoRA'}\n\n`
  readme += `This LoRA was uploaded via OpenMuse.ai: [https://openmuse.ai/](https://openmuse.ai/)\n\n`
  readme += `## Model Details\n\n`
  readme += `**File:** \`./${loraFileName}\` ([Download Link](https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(loraFileName)}))\n\n`
  readme += `**Base Model:** ${loraDetails.model || 'N/A'} (${loraDetails.modelVariant || 'N/A'})\n`
  readme += `**LoRA Type:** ${loraDetails.loraType || 'N/A'}\n\n`
  readme += `### Trigger Words & Usage Notes\n`
  readme += "```text\n"
  readme += `${loraDetails.loraDescription || 'No specific trigger words or usage notes provided.'}\n`
  readme += "```\n\n"

  if (loraDetails.creator === 'someone_else' && loraDetails.creatorName) {
    readme += `## Creator Information\n`
    readme += `Originally created by: **${loraDetails.creatorName}**\n\n`
  }

  if (uploadedVideoPaths && uploadedVideoPaths.length > 0) {
    readme += `## Example Media Files\n`
    readme += `The following media files were uploaded as examples for this LoRA:\n\n`
    uploadedVideoPaths.forEach((videoPath, index) => {
      const videoFileName = videoPath.split('/').pop() || `Example Video ${index + 1}`
      readme += `* **${videoFileName}**: [View Media](./${videoPath}) or [Download](https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(videoPath)})\n`
    })
    readme += `\n`
  }

  return readme
} 