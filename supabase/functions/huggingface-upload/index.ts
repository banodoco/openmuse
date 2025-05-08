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

    // Get the request body
    const { loraFile, loraDetails, videos } = await req.json()

    // Upload to Hugging Face
    const hfUser = await whoAmI({ credentials: { accessToken: hfToken } })
    if (!hfUser.name) {
      throw new Error('Could not determine HuggingFace username')
    }

    const username = hfUser.name
    const repoName = sanitizeRepoName(loraDetails.loraName) || `unnamed-lora-${Date.now()}`
    const repoId = `${username}/${repoName}`

    // Create or ensure repo exists
    try {
      await createRepo({
        repo: repoId,
        private: false,
        credentials: { accessToken: hfToken }
      })
    } catch (error: any) {
      if (!error.message?.toLowerCase().includes('already exists')) {
        throw error
      }
    }

    // Upload LoRA file
    await uploadFile({
      repo: repoId,
      file: loraFile,
      credentials: { accessToken: hfToken },
    })

    // Upload videos if any
    const uploadedVideoPaths: string[] = []
    if (videos && videos.length > 0) {
      for (let i = 0; i < Math.min(videos.length, 3); i++) {
        const videoItem = videos[i]
        if (videoItem.file) {
          const videoFileName = videoItem.file.name
          const targetPathInRepo = `media/${videoFileName}`
          await uploadFile({
            repo: repoId,
            file: { path: targetPathInRepo, content: videoItem.file },
            credentials: { accessToken: hfToken },
          })
          uploadedVideoPaths.push(targetPathInRepo)
        }
      }
    }

    // Generate and upload README
    const readmeContent = generateReadmeContent(loraDetails, videos, uploadedVideoPaths, loraFile.name, repoId)
    const readmeBlob = new Blob([readmeContent], { type: 'text/markdown' })
    const readmeFile = new File([readmeBlob], 'README.md', { type: 'text/markdown' })
    await uploadFile({
      repo: repoId,
      file: readmeFile,
      credentials: { accessToken: hfToken },
    })

    const loraFileUrl = `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(loraFile.name)}`

    return new Response(
      JSON.stringify({ success: true, url: loraFileUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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

function generateReadmeContent(loraDetails: any, videos: any[], uploadedVideoPaths: string[], loraFileName: string, repoId: string): string {
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
      const videoFileName = videoPathInRepo.split('/').pop()
      const videoItem = videos.find(v => v.file && v.file.name === videoFileName)
      if (videoItem && videoItem.metadata.description) {
        const promptText = videoItem.metadata.description.replace(/\n/g, ' ').replace(/\"/g, '\\"')
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