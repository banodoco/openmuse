import React, { useState, useEffect } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import { toast } from 'sonner';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoRADetailsForm, MultipleVideoUploader } from './components';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { supabaseStorage } from '@/lib/supabaseStorage';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { VideoItem } from '@/lib/types';
import { thumbnailService } from '@/lib/services/thumbnailService';
import { getVideoAspectRatio } from '@/lib/utils/videoDimensionUtils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import HuggingFaceService, { type HuggingFaceRepoInfo } from '@/lib/services/huggingfaceService';

const logger = new Logger('Upload');

// Helper function to safely stringify objects with non-JSON-serializable content like File objects
function safeStringify(obj: any, indent = 2): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof File) {
        return `[File: ${value.name}, size: ${value.size}, type: ${value.type}]`;
      }
      return value;
    }, indent);
  } catch (e) {
    console.error('Error stringifying object:', e);
    return '[Object could not be stringified]';
  }
}

// Define the LoRADetails type explicitly
export interface LoRADetails {
  loraName: string;
  loraDescription: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  model: string;
  modelVariant: string; // Can be more specific if needed
  loraType: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Control' | 'Other';
  loraStorageMethod: 'upload' | 'link';
  loraLink: string;
  huggingFaceApiKey?: string;
  loraDirectDownloadLink?: string; // Added for the optional direct download link from form
  saveApiKey: boolean;
  // Add new fields for storage paths if needed, though these might be constructed in handleSubmit
  // loraSupabasePath?: string; 
}

// New interface for video metadata when passing to huggingfaceUploader
export interface VideoItemUploadMetadata {
  storagePath?: string; // Path in Supabase 'temporary' bucket for new uploads
  existingUrl?: string; // URL if it's an existing video not being re-uploaded
  metadata: any; // Existing metadata structure
  originalFileName?: string; // To help map in edge function
}

interface UploadPageProps {
  initialMode?: 'lora' | 'media';
  forcedLoraId?: string;
  defaultClassification?: 'art' | 'gen';
  hideLayout?: boolean;
  onSuccess?: () => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ initialMode: initialModeProp, forcedLoraId: forcedLoraIdProp, defaultClassification: defaultClassificationProp, hideLayout = false, onSuccess }) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStepMessage, setCurrentStepMessage] = useState<string>('');
  const [loraFile, setLoraFile] = useState<File | null>(null);
  
  const [loraDetails, setLoraDetails] = useState<LoRADetails>({
    loraName: '',
    loraDescription: '',
    creator: 'self',
    creatorName: '',
    model: '',
    modelVariant: '',
    loraType: 'Concept',
    loraStorageMethod: 'upload',
    loraLink: '',
    huggingFaceApiKey: '',
    loraDirectDownloadLink: '',
    saveApiKey: true
  });
  
  const updateLoRADetails = (field: keyof LoRADetails, value: string | boolean) => {
    setLoraDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const [videos, setVideos] = useState<any[]>([]);
  
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  // Determine initial mode and forced LoRA ID from query params OR props
  const initialModeParam = searchParams.get('mode'); // expected values: 'media' | 'lora'
  const forcedLoraIdParam = searchParams.get('loraId');
  const classificationParam = searchParams.get('classification'); // expected values: 'art' | 'gen'

  // Prioritize props over query params
  const finalInitialMode = initialModeProp ?? (initialModeParam === 'media' ? 'media' : (initialModeParam === 'lora' ? 'lora' : undefined));
  const finalForcedLoraId = forcedLoraIdProp ?? forcedLoraIdParam;
  const finalDefaultClassification: 'art' | 'gen' = defaultClassificationProp ?? ((classificationParam === 'art' || classificationParam === 'gen') ? classificationParam : 'gen');

  // Upload mode state – 'lora' (LoRA + media) | 'media' (media‑only)
  const defaultMode: 'lora' | 'media' = (finalForcedLoraId || finalInitialMode === 'media') ? 'media' : 'lora';
  const [uploadMode, setUploadMode] = useState<'lora' | 'media'>(defaultMode);
  const hideModeSelector = !!finalForcedLoraId || !!finalInitialMode;

  // LoRA selection when uploading media only
  const [availableLoras, setAvailableLoras] = useState<{ id: string; name: string }[]>([]);

  // Fetch available LoRAs when needed
  useEffect(() => {
    const fetchLoras = async () => {
      if (uploadMode !== 'media' || finalForcedLoraId) return; // only fetch when we need list
      const { data, error } = await supabase
        .from('assets')
        .select('id, name')
        .or('type.eq.lora,type.eq.LoRA');
      if (!error && data) {
        setAvailableLoras(data as { id: string; name: string }[]);
      }
    };
    fetchLoras();
  }, [uploadMode, finalForcedLoraId]);

  // Effect to fetch and pre-fill HuggingFace API key if 'upload' method is selected and user has a saved key
  useEffect(() => {
    console.log('[API Key Effect RUNNING] User:', !!user, 'Storage Method:', loraDetails.loraStorageMethod, 'Current Key in loraDetails:', loraDetails.huggingFaceApiKey);
    const fetchAndSetApiKey = async () => {
      if (user && loraDetails.loraStorageMethod === 'upload') {
        console.log('[API Key Effect Condition MET] User and Upload method. Current Key:', loraDetails.huggingFaceApiKey);
        // Check if API key is already fetched or being entered manually to avoid override
        // This simple check might need refinement if manual entry and auto-fetch can conflict
        if (loraDetails.huggingFaceApiKey && loraDetails.huggingFaceApiKey.startsWith('hf_')) {
            console.log('[API Key Effect] Key already present or being entered, skipping fetch.');
            return;
        }

        console.log('[API Key Effect] Upload method selected, attempting to fetch saved API key for user:', user.id);
        try {
          const { data, error } = await supabase
            .from('api_keys')
            .select('key_value') // Select the actual key column
            .eq('user_id', user.id)
            .eq('service', 'huggingface')
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116: "single row not found" - this is okay, means no key
            console.error('[API Key Effect] Error fetching API key:', error);
            toast.error('Could not fetch your saved Hugging Face API key.');
          } else if (data && data.key_value) { // Access the correct column
            console.log('[API Key Effect] Successfully fetched API key. Updating loraDetails.');
            updateLoRADetails('huggingFaceApiKey', data.key_value); // Use the correct column
            // Optionally, you might want to ensure 'saveApiKey' reflects that this is a saved key,
            // though current form logic for display relies on 'hasExistingApiKey' from its own fetch.
          } else {
            console.log('[API Key Effect] No saved Hugging Face API key found for this user.');
            // If no key is found, loraDetails.huggingFaceApiKey remains as it is (likely empty),
            // and the form should show the input field if it's configured to do so based on its own check.
          }
        } catch (e) {
          console.error('[API Key Effect] Exception during API key fetch:', e);
          toast.error('An unexpected error occurred while fetching your API key.');
        }
      } else if (loraDetails.loraStorageMethod !== 'upload' && loraDetails.huggingFaceApiKey) {
        // If storage method changes away from 'upload', clear any fetched/entered API key
        // This prevents an old key from being accidentally used if the user switches back and forth.
        // However, the GlobalLoRADetailsForm already does this in its onValueChange for loraStorageMethod.
        // Keeping this commented for now as it might be redundant or cause loops if not careful.
        // console.log('[API Key Effect] Storage method is not upload, clearing API key from loraDetails.');
        // updateLoRADetails('huggingFaceApiKey', '');
      }
    };

    fetchAndSetApiKey();
  }, [user, loraDetails.loraStorageMethod]); // Removed updateLoRADetails from deps to avoid potential loops, check loraDetails.huggingFaceApiKey directly

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log('[handleSubmit] Triggered');
    
    if (!user) {
      toast.error('You must be signed in to submit videos');
      console.log('[handleSubmit] User not signed in, navigating to /auth');
      navigate('/auth');
      return;
    }
    console.log('[handleSubmit] User check passed. User ID:', user.id);
    
    const hasVideos = videos.some(video => video.file !== null || video.url !== null);
    if (!hasVideos) {
      toast.error('Please add at least one video (file or link)');
      console.log('[handleSubmit] No videos found.', videos);
      return;
    }
    console.log('[handleSubmit] Video check passed.', videos);
    
    setIsSubmitting(true);
    setCurrentStepMessage('Preparing submission...');
    console.log('[handleSubmit] Set submitting state. Current Step: Preparing submission...');

    // Log state right before the main try block
    console.log('[handleSubmit] State before main logic:', { 
      uploadMode, 
      loraFile: loraFile ? { name: loraFile.name, size: loraFile.size, type: loraFile.type } : null,
      loraDetails, 
      videos 
    });
    console.log('CHECKPOINT 1');

    if (uploadMode === 'media') {
      console.log('CHECKPOINT 2 - MEDIA MODE');
      // MEDIA ONLY FLOW --------------------------------------------------
      const reviewerName = user?.email || 'Anonymous';
      try {
        setCurrentStepMessage('Processing video files...');
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          if (video.file) {
            const videoName = video.file.name || `video ${i + 1}`;
            setCurrentStepMessage(`Uploading ${videoName}...`);
            const videoId = uuidv4();
            const uploadResult = await supabaseStorage.uploadVideo({
              id: videoId,
              blob: video.file,
              metadata: { ...video.metadata }
            });
            video.url = uploadResult.url;
            video.id = videoId;
            video.file = null;
            setCurrentStepMessage(`${videoName} uploaded. Processing...`);
          }
        }

        setCurrentStepMessage('Saving media entries to database...');
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          if (!video.url) continue;
          const videoName = video.metadata.title || `media entry ${i + 1}`;
          setCurrentStepMessage(`Saving ${videoName}...`);
          
          logger.log(`Processing video ${video.id} for media entry creation. URL: ${video.url}`);

          // Calculate aspect ratio for media-only upload
          let aspectRatio = 16 / 9; // Default aspect ratio
          try {
            logger.log(`Attempting to get aspect ratio for video ${video.id}...`);
            aspectRatio = await getVideoAspectRatio(video.url);
            logger.log(`Successfully got aspect ratio for video ${video.id}: ${aspectRatio}`);
          } catch (ratioError) {
            logger.error(`Error getting aspect ratio for video ${video.id} (URL: ${video.url}):`, ratioError);
          }

          // Generate thumbnail for media-only upload
          let thumbnailUrl: string | null = null;
          try {
            logger.log(`Attempting to generate thumbnail for video ${video.id}...`);
            thumbnailUrl = await thumbnailService.generateThumbnail(video.url);
            logger.log(`Successfully generated thumbnail for video ${video.id}: ${thumbnailUrl ? 'Generated' : 'Failed or null'}`);
          } catch (thumbError) {
             logger.error(`Error generating thumbnail for video ${video.id} (URL: ${video.url}):`, thumbError);
          }

          logger.log(`STEP 1: Before DB Insert for video ${video.id}`);
          const { data: mediaData, error: mediaError } = await supabase
            .from('media')
            .insert({
              title: video.metadata.title || '',
              url: video.url,
              type: 'video',
              classification: video.metadata.classification || 'art',
              user_id: user?.id || null,
              metadata: { aspectRatio: aspectRatio },
              placeholder_image: thumbnailUrl,
              admin_status: 'Listed',
              user_status: 'Listed'
            })
            .select()
            .single();
          logger.log(`STEP 2: After DB Insert (Before Error Check) for video ${video.id}`);

          if (mediaError || !mediaData) {
            logger.error(`STEP 3: DB Insert FAILED for video ${video.id}:`, mediaError);
            continue;
          }
          logger.log(`STEP 4: DB Insert SUCCESSFUL (Before mediaId assignment) for video ${video.id}`);

          const mediaId = mediaData.id;
          logger.log(`Successfully created media entry for video ${video.id}. Media ID: ${mediaId}`);

          if (finalForcedLoraId) {
            setCurrentStepMessage(`Linking ${videoName} to LoRA...`);
            logger.log(`Linking media ${mediaId} to existing asset ${finalForcedLoraId}`);
            const { error: linkError } = await supabase
              .from('asset_media')
              .insert({ asset_id: finalForcedLoraId, media_id: mediaId });
            if (linkError) {
              logger.error(`Error linking media ${mediaId} to asset ${finalForcedLoraId}:`, linkError);
            } else {
              logger.log(`Successfully linked media ${mediaId} to asset ${finalForcedLoraId}`);
            }
            const shouldSetPrimary = video.metadata.isPrimary || false;
            if (shouldSetPrimary) {
              setCurrentStepMessage(`Setting ${videoName} as primary media...`);
              logger.log(`Setting media ${mediaId} as primary for asset ${finalForcedLoraId}`);
              const { error: primaryErr } = await supabase
                .from('assets')
                .update({ primary_media_id: mediaId })
                .eq('id', finalForcedLoraId);
              if (primaryErr) {
                logger.error(`Error setting primary media for asset ${finalForcedLoraId}:`, primaryErr);
              }
            }
          }
        }

        logger.log('Finished processing all videos for media entry creation.');
        setCurrentStepMessage('Submission complete!');
        toast.success('Media submitted successfully! Awaiting admin approval.');
        logger.log('Success toast shown.');
        if (onSuccess) {
          onSuccess();
        }
      } catch (error: any) {
        console.error('Error submitting media:', error);
        toast.error(error.message || 'Failed to submit media');
        setCurrentStepMessage('Submission failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    console.log('CHECKPOINT 3 - LORA MODE');
    
    // Log the details being checked
    console.log('[Validation] Checking loraDetails:', safeStringify(loraDetails));
    console.log('[Validation] Checking loraFile:', loraFile ? `File: ${loraFile.name}` : 'null');
    
    if (!loraDetails.loraName) {
      console.log('[Validation] FAILED: loraName is missing');
      toast.error('Please provide a LoRA name');
      setIsSubmitting(false);
      return;
    }
    console.log('[Validation] PASSED: loraName check');
    
    if (loraDetails.creator === 'someone_else' && !loraDetails.creatorName) {
      console.log('[Validation] FAILED: creatorName is missing for someone_else');
      toast.error('Please provide the creator name for the LoRA');
      setIsSubmitting(false);
      return;
    }
    console.log('[Validation] PASSED: creatorName check');
    
    // New validation logic for LoRA link / HuggingFace Upload
    if (uploadMode === 'lora') { // Only validate these if we are in LoRA upload mode
      console.log('[Validation] Inside uploadMode === lora block. loraStorageMethod:', loraDetails.loraStorageMethod);
      if (loraDetails.loraStorageMethod === 'link') {
        console.log('[Validation] Checking loraStorageMethod: link');
        const hasLoraLink = loraDetails.loraLink && loraDetails.loraLink.trim() !== '';
        const hasDirectDownloadLink = loraDetails.loraDirectDownloadLink && loraDetails.loraDirectDownloadLink.trim() !== '';
        console.log('[Validation] Link checks: hasLoraLink:', hasLoraLink, 'hasDirectDownloadLink:', hasDirectDownloadLink);

        if (!hasLoraLink && !hasDirectDownloadLink) {
          console.log('[Validation] FAILED: Both loraLink and loraDirectDownloadLink are missing');
          toast.error('Please provide either the LoRA Link or the Direct Download Link (or both).');
          setIsSubmitting(false);
          return;
        }
        if (hasLoraLink) {
          try {
            new URL(loraDetails.loraLink);
            console.log('[Validation] PASSED: loraLink URL validation');
          } catch (_) {
            console.log('[Validation] FAILED: loraLink is not a valid URL');
            toast.error('Please enter a valid URL for the LoRA Link.');
            setIsSubmitting(false);
            return;
          }
        }
        if (hasDirectDownloadLink) {
          try {
            new URL(loraDetails.loraDirectDownloadLink);
            console.log('[Validation] PASSED: loraDirectDownloadLink URL validation');
          } catch (_) {
            console.log('[Validation] FAILED: loraDirectDownloadLink is not a valid URL');
            toast.error('Please enter a valid URL for the Direct Download Link.');
            setIsSubmitting(false);
            return;
          }
        }
        console.log('[Validation] PASSED: link method checks');
      } else if (loraDetails.loraStorageMethod === 'upload') {
        console.log('[Validation] Checking loraStorageMethod: upload');
        if (!loraDetails.huggingFaceApiKey || loraDetails.huggingFaceApiKey.trim() === '') {
          console.log('[Validation] FAILED: huggingFaceApiKey is missing');
          toast.error('Please provide your HuggingFace API Key');
          setIsSubmitting(false);
          return;
        }
        console.log('[Validation] PASSED: huggingFaceApiKey check');
        if (!loraFile) {
          console.log('[Validation] FAILED: loraFile is missing');
          toast.error('Please select a LoRA file to upload');
          setIsSubmitting(false);
          return;
        }
        console.log('[Validation] PASSED: loraFile check');
        // Potentially add more validation for loraFile (type, size) if needed
      }
      console.log('[Validation] PASSED: uploadMode === lora block');
    }

    console.log('CHECKPOINT 4 - BEFORE VIDEOS LOG');
    // Log the entire videos array content for detailed inspection - using safeStringify
    console.log('[handleSubmit] Videos array before primary check:', safeStringify(videos));
    console.log('CHECKPOINT 5 - AFTER VIDEOS LOG');

    console.log('CHECKPOINT 6 - BEFORE hasPrimary calculation');
    // Robust check for primary video
    const hasPrimary = videos.some(video => 
      (video.file || video.url) && 
      video.metadata && 
      video.metadata.isPrimary
    );
    console.log('CHECKPOINT 7 - AFTER hasPrimary calculation. Value:', hasPrimary);

    if (!hasPrimary) {
      console.log('CHECKPOINT 8 - INSIDE !hasPrimary block (ERROR IF HERE)');
      toast.error('Please set one video as the primary media for this LoRA');
      setIsSubmitting(false); // Also ensure isSubmitting is reset
      return;
    }
    console.log('CHECKPOINT 9 - SKIPPED !hasPrimary block (SUCCESS)');
    
    const reviewerName = user?.email || 'Anonymous';
    console.log('CHECKPOINT 10 - AFTER reviewerName assignment. Value:', reviewerName);

    // Declare variables here to be in scope for both HF operations and README update step
    let repoInfo: HuggingFaceRepoInfo | null = null; 
    let uploadedVideoHfPaths: { text: string, output: { url: string } }[] = [];
    let hfService: HuggingFaceService | null = null;

    try {
      console.log('CHECKPOINT 11 - ENTERED TRY BLOCK');
      // The actual first setCurrentStepMessage will be conditional based on loraDetails.loraStorageMethod
      // For example:
      // setCurrentStepMessage('Uploading LoRA file to temporary storage...');
      // OR
      // setCurrentStepMessage('Processing and uploading example media files...');

      let finalLoraLink = '';
      let directDownloadUrlToSave = '';
      let loraSupabaseStoragePath: string | undefined = undefined;
      const videoMetadataForHfUpload: VideoItemUploadMetadata[] = [];

      if (uploadMode === 'lora') {
        console.log('CHECKPOINT 11.1 - LORA MODE, before storage method check');
        if (loraDetails.loraStorageMethod === 'upload') {
          console.log('CHECKPOINT 11.2 - LORA UPLOAD METHOD SELECTED');
          if (!loraFile || !loraDetails.huggingFaceApiKey) {
            toast.error("LoRA file or HuggingFace API Key missing for upload.");
            setCurrentStepMessage('Error: Missing LoRA file or API key.');
            setIsSubmitting(false);
            return;
          }
          console.log('CHECKPOINT 11.3 - LoRA file and API key present');
          setCurrentStepMessage('Initializing Hugging Face service...');

          try {
            console.log('[HF Upload] About to instantiate HuggingFaceService.');
            hfService = new HuggingFaceService(loraDetails.huggingFaceApiKey);
            console.log('[HF Upload] HuggingFaceService instantiated successfully.');

            // Sanitize loraName for use as a repo name (simple example, might need more robust slugification)
            const repoName = sanitizeRepoName(loraDetails.loraName) || `lora-model-${uuidv4().substring(0,8)}`;
            if (!repoName) { // Fallback if sanitizeRepoName results in empty string
                toast.error("Invalid LoRA name for Hugging Face repository.");
                setIsSubmitting(false);
                return;
            }
            setCurrentStepMessage(`Creating Hugging Face repository: ${repoName}...`);
            logger.log(`[HF Upload] Attempting to create HF repo: ${repoName} with key: ${loraDetails.huggingFaceApiKey}`);

            console.log(`[HF Upload] About to call createOrGetRepo for repo: ${repoName}`);
            repoInfo = await hfService.createOrGetRepo(repoName);
            console.log('[HF Upload] createOrGetRepo call finished.');
            logger.log('[HF Upload] Hugging Face Repository Info:', repoInfo);
            setCurrentStepMessage(`Hugging Face repository ready: ${repoInfo.url}`);

            // TODO: Next steps will be uploading files to this repoInfo.repoIdString
            // For now, we will stop here to test repo creation and then proceed to database save (skipping old HF upload)
            
            finalLoraLink = repoInfo.url; // The general repo URL

            if (loraFile) {
              setCurrentStepMessage(`Uploading LoRA file (${loraFile.name}) to ${repoInfo.repoIdString}...`);
              console.log(`[HF Upload] Attempting to upload LoRA file: ${loraFile.name} to repo: ${repoInfo.repoIdString}`);
              try {
                const loraFileNameInRepo = loraFile.name; // Or a sanitized version
                const commitUrl = await hfService.uploadRawFile({
                  repoIdString: repoInfo.repoIdString,
                  fileContent: loraFile,
                  pathInRepo: loraFileNameInRepo, // This is used by the service if fileContent is Blob, File.name is used if File
                  commitTitle: `Upload LoRA file: ${loraFileNameInRepo}`
                });
                console.log(`[HF Upload] LoRA file uploaded. Commit URL: ${commitUrl}`);
                // Construct the direct download URL. Pattern: {repoUrl}/resolve/main/{fileName}
                // The `commitUrl` from hf.co/api/uploadFile might be just the commit itself, not the direct file URL.
                // The direct download URL is typically: https://huggingface.co/{repoIdString}/resolve/main/{fileNameInRepo}
                directDownloadUrlToSave = `${repoInfo.url}/resolve/main/${encodeURIComponent(loraFileNameInRepo)}`;
                logger.log(`[HF Upload] LoRA file direct download URL set to: ${directDownloadUrlToSave}`);
                setCurrentStepMessage('LoRA file uploaded to Hugging Face!');
                toast.success(`LoRA file uploaded to ${repoInfo.url}`);

                // === Step 3: Upload Example Videos to Hugging Face ===
                const uploadedVideoHfPaths: { text: string, output: { url: string } }[] = [];
                if (videos && videos.length > 0) {
                  setCurrentStepMessage('Uploading example media to Hugging Face...');
                  for (const videoItem of videos) {
                    if (videoItem.file) {
                      const videoFileNameInRepo = `assets/${videoItem.file.name}`;
                      console.log(`[HF Upload] Attempting to upload example video: ${videoItem.file.name} to repo path: ${videoFileNameInRepo}`);
                      try {
                        // First upload to Supabase Storage
                        const videoId = uuidv4();
                        const uploadResult = await supabaseStorage.uploadVideo({
                          id: videoId,
                          blob: videoItem.file,
                          metadata: { ...videoItem.metadata }
                        });
                        videoItem.url = uploadResult.url;
                        videoItem.id = videoId;
                        
                        // Then upload to Hugging Face
                        await hfService.uploadRawFile({
                          repoIdString: repoInfo.repoIdString,
                          fileContent: videoItem.file,
                          pathInRepo: videoFileNameInRepo,
                          commitTitle: `Upload example media: ${videoItem.file.name}`
                        });
                        console.log(`[HF Upload] Example video ${videoItem.file.name} uploaded.`);
                        // The path in the widget should be relative to the repo root
                        uploadedVideoHfPaths.push({
                          text: videoItem.metadata.description || videoItem.metadata.title || "Example prompt",
                          output: { url: videoFileNameInRepo }
                        });
                      } catch (videoUploadError: any) {
                        logger.error(`[HF Upload] Example video ${videoItem.file.name} upload failed:`, videoUploadError);
                        toast.warning(`Failed to upload example video ${videoItem.file.name}. It will be skipped in README.`);
                        // Continue to next video
                      }
                    } else if (videoItem.url) {
                        // If it's a URL, we can't upload it directly to HF assets unless we download it first.
                        // For now, we'll skip pre-existing URLs for the HF widget.
                        logger.log(`[HF Upload] Skipping video with existing URL for HF assets: ${videoItem.url}`);
                    }
                  }
                  setCurrentStepMessage('Example media processing complete.');
                }

                // === Step 4: Generate and Upload README.md (First Pass) ===
                setCurrentStepMessage('Generating README.md for Hugging Face repository...');
                const initialReadmeContent = generateReadmeContent(
                  loraDetails,
                  uploadedVideoHfPaths, // No OpenMuse URL yet
                );
                console.log("[HF Upload] Generated initial README.md content:", initialReadmeContent);
                try {
                  await hfService.uploadTextAsFile({
                    repoIdString: repoInfo.repoIdString,
                    textData: initialReadmeContent,
                    pathInRepo: 'README.md',
                    commitTitle: 'Add LoRA model card (README.md)'
                  });
                  console.log('[HF Upload] Initial README.md uploaded successfully.');
                  toast.success('Initial README.md uploaded to Hugging Face repository.');
                } catch (readmeError: any) {
                  logger.error("[HF Upload] Initial README.md upload failed:", readmeError);
                  toast.error(`Failed to upload initial README.md: ${readmeError.message || 'Unknown error'}`);
                  // Don't fail the whole submission for README error, but log it.
                }

              } catch (uploadError: any) {
                logger.error("[HF Upload] LoRA file upload failed:", uploadError);
                console.error("[HF Upload] loraFile uploadError object:", uploadError);
                toast.error(`LoRA file upload failed: ${uploadError.message || 'Unknown error'}`);
                setCurrentStepMessage(`LoRA file upload failed: ${uploadError.message || 'Unknown error'}.`);
                setIsSubmitting(false);
                return; 
              }
            } else {
              // This case should ideally be caught by earlier validation
              logger.warn("[HF Upload] Lora file is null, cannot upload to Hugging Face.");
              toast.error("LoRA file was missing, cannot complete Hugging Face upload.");
              setIsSubmitting(false);
              return;
            }
            
            // toast.success(`Test: HF Repo created/accessed: ${repoInfo.url}`); // Original Test Toast
            // logger.log(`[HF Upload] TEMPORARY END OF HF UPLOAD FLOW. Repo URL: ${repoInfo.url}`); // Original log

            // --- Code for Supabase temp storage and old edge function call (TO BE REMOVED/REPLACED) ---
            // The following block will be replaced by direct client-side uploads to HF repoInfo.repoIdString
            /* 
            // Step 1: Upload LoRA file to Supabase temporary storage
            try {
              const loraFileName = loraFile.name;
              setCurrentStepMessage(`Uploading LoRA file (${loraFileName}) to temporary storage...`);
              // ... supabase temp upload logic ...
              loraSupabaseStoragePath = loraSbUploadData.path;
              setCurrentStepMessage('LoRA file temporarily stored. Processing videos...');
            } catch (tempUploadError: any) {
              // ... error handling ...
              setIsSubmitting(false);
              return;
            }

            // Step 2: Upload Video files to Supabase temporary storage
            for (const video of videos) {
              // ... supabase temp video upload logic ...
            }
            setCurrentStepMessage('All files temporarily stored. Proceeding to Hugging Face...');

            // Step 3: Call uploadLoraToHuggingFace with storage paths (OLD METHOD)
            const hfFileNameForDisplay = loraFile.name || 'LoRA file';
            setCurrentStepMessage(`Transferring ${hfFileNameForDisplay} and videos to Hugging Face... This may take a moment.`);
            logger.log(`Calling OLD uploadLoraToHuggingFace with LoRA path: ${loraSupabaseStoragePath}`);
            
            const hfResponse = await uploadLoraToHuggingFace({
              loraStoragePath: loraSupabaseStoragePath, 
              loraDetails: loraDetails,
              videosMetadata: videoMetadataForHfUpload, 
              hfToken: loraDetails.huggingFaceApiKey,
              saveApiKey: loraDetails.saveApiKey
            });

            if (!hfResponse || typeof hfResponse !== 'object' || !hfResponse.loraUrl) {
              throw new Error("Failed to process LoRA via HuggingFace. Invalid response from uploader.");
            }

            const uploadedHfLoraUrl = hfResponse.loraUrl;
            const uploadedHfVideoUrls = hfResponse.videoUrls || [];

            const repoUrlFromOld = uploadedHfLoraUrl.split('/resolve/')[0];
            finalLoraLink = repoUrlFromOld;
            directDownloadUrlToSave = uploadedHfLoraUrl;
            setCurrentStepMessage("LoRA and media transferred to Hugging Face! Saving details...");
            logger.log(`LoRA and media transferred to HuggingFace (OLD): Repo URL: ${finalLoraLink}, LoRA File URL: ${directDownloadUrlToSave}`);
            logger.log(`Returned Video URLs from HF (OLD):`, uploadedHfVideoUrls);
            
            // Update videos state with HF URLs (OLD logic, needs to be adapted for new client-side flow)
            // setVideos(updatedVideosForDb);

            toast.success("LoRA and media successfully processed via HuggingFace (OLD METHOD)!");
            */
            // --- END OF OLD HF UPLOAD FLOW ---

          } catch (hfClientError: any) {
            logger.error("[HF Upload] Client-side Hugging Face operation failed:", hfClientError);
            console.error("[HF Upload] hfClientError object:", hfClientError); 
            toast.error(`Hugging Face Error: ${hfClientError.message || 'Unknown error'}`);
            setCurrentStepMessage(`Hugging Face operation failed: ${hfClientError.message || 'Unknown error'}.`);
            setIsSubmitting(false);
            return; 
          }
        } else { // loraStorageMethod === 'link'
          const formLoraLink = loraDetails.loraLink.trim();
          const formDirectDownloadLink = loraDetails.loraDirectDownloadLink?.trim();

          if (formLoraLink && formDirectDownloadLink) {
            finalLoraLink = formLoraLink;
            directDownloadUrlToSave = formDirectDownloadLink;
          } else if (formLoraLink) {
            finalLoraLink = formLoraLink;
            directDownloadUrlToSave = formLoraLink; // Use general link as direct if only general is provided
          } else if (formDirectDownloadLink) {
            finalLoraLink = formDirectDownloadLink; // Use direct link as general if only direct is provided
            directDownloadUrlToSave = formDirectDownloadLink;
          }
          // If neither, validation should have caught this, but as a fallback:
          // finalLoraLink and directDownloadUrlToSave remain empty or default
        }
      }
      
      setCurrentStepMessage('Processing and uploading example media files...');
      // This loop is for processing local files to Supabase for LINKED LoRAs, not for HF uploads from temp.
      // For HF uploads from temp storage, video processing into videoMetadataForHfUpload is already done.
      // This original loop will now only run if loraDetails.loraStorageMethod === 'link'
      if (loraDetails.loraStorageMethod === 'link') {
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        if (video.file) {
          const videoName = video.file.name || `example media ${i + 1}`;
          setCurrentStepMessage(`Uploading ${videoName}...`);
          const videoId = uuidv4();
          
          const uploadResult = await supabaseStorage.uploadVideo({
            id: videoId,
            blob: video.file,
            metadata: {
              ...video.metadata,
              model: loraDetails.model, 
              modelVariant: loraDetails.modelVariant 
            }
          });
          
          video.url = uploadResult.url;
          video.id = videoId;
          video.file = null; 
          setCurrentStepMessage(`${videoName} uploaded. Continuing...`);
        }
        }
      } else { // loraStorageMethod === 'upload' (to Hugging Face)
        // For HF uploads, the videos array might now contain `storagePath` if we choose to update it,
        // or we rely on videoMetadataForHfUpload. For submitVideos, we need URLs.
        // This needs careful handling: submitVideos expects video.url
        // We need to update the `videos` array with URLs if they were uploaded for HF, or keep original URLs if they existed.
        // For now, let's assume `videoMetadataForHfUpload` is the source of truth for what was processed for HF.
        // The `submitVideos` function might need adjustment if it expects `videos` state to have final URLs
        // when assets were processed through HF.
        // For now, we assume that if it was a HF upload, the directDownloadUrlToSave (for LoRA) and video URLs (if HF returned them)
        // would be used. But our HF edge function currently only returns LoRA URL.
        // This part needs more thought on how `submitVideos` gets the final video URLs post-HF upload.
        // Let's simplify: if HF upload happened, the `videos` array's items might not have `url` populated yet from HF process.
        // This part will be tricky if submitVideos is used for both flows without modification.
        // SOLUTION: The code above now updates the `videos` state with the final HF URLs
        // before submitVideos is called, so it should receive the correct URLs.
      }
      
      setCurrentStepMessage('Saving LoRA and media details to database...');
      // Pass the potentially updated `videos` state to submitVideos
      const assetCreationResult = await submitVideos(videos, loraDetails, reviewerName, user, finalLoraLink, directDownloadUrlToSave, setCurrentStepMessage);
      
      // === Step 5: Update README.md with OpenMuse Link ===
      if (uploadMode === 'lora' && loraDetails.loraStorageMethod === 'upload' && assetCreationResult && assetCreationResult.assetId && repoInfo && hfService) {
        const openMuseAssetUrl = `https://openmuse.ai/assets/loras/${assetCreationResult.assetId}`;
        setCurrentStepMessage('Updating README.md with OpenMuse link...');
        console.log(`[HF Upload] Attempting to update README.md with OpenMuse URL: ${openMuseAssetUrl}`);
        
        const updatedReadmeContent = generateReadmeContent(
          loraDetails,
          uploadedVideoHfPaths, // Reuse the paths from the earlier video upload step
          openMuseAssetUrl
        );
        console.log("[HF Upload] Generated updated README.md content:", updatedReadmeContent);
        try {
          // Re-upload README.md with the appended link
          await hfService.uploadTextAsFile({
            repoIdString: repoInfo.repoIdString, 
            textData: updatedReadmeContent,
            pathInRepo: 'README.md',
            commitTitle: 'Update README.md with OpenMuse link'
          });
          console.log('[HF Upload] README.md updated successfully with OpenMuse link.');
          toast.success('README.md updated with OpenMuse link.');
        } catch (readmeUpdateError: any) {
          logger.error("[HF Upload] Failed to update README.md with OpenMuse link:", readmeUpdateError);
          toast.warning('Failed to update README.md with OpenMuse link. The link will be missing on Hugging Face.');
          // Continue anway, primary submission was successful
        }
      }

      const message = videos.filter(v => v.url).length > 1 
        ? 'Videos submitted successfully! Awaiting admin approval.'
        : 'Video submitted successfully! Awaiting admin approval.';
      
      setCurrentStepMessage('Submission complete!');
      toast.success(message);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (error: any) {
      console.error('Error submitting videos:', error);
      toast.error(error.message || 'Failed to submit videos');
      setCurrentStepMessage('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const submitVideos = async (
    videos: VideoItem[], 
    loraDetails: LoRADetails, 
    reviewerName: string, 
    user: any, 
    finalLoraLinkToUse: string,
    directDownloadUrlToSave: string,
    setCurrentStepMsg: (message: string) => void
  ): Promise<{ assetId: string | null }> => {
    logger.log("Starting asset creation and video submission process");
    setCurrentStepMsg('Creating LoRA asset entry...');

    let assetId = '';
    let primaryMediaId: string | null = null;

    try {
      // Step 1: Create the Asset entry
      logger.log(`Creating asset: ${loraDetails.loraName}`);
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert({
          name: loraDetails.loraName,
          description: loraDetails.loraDescription,
          creator: loraDetails.creator === 'someone_else' ? loraDetails.creatorName : reviewerName,
          user_id: loraDetails.creator === 'self' ? (user?.id || null) : null,
          curator_id: loraDetails.creator === 'someone_else' ? (user?.id || null) : null,
          type: 'lora',
          lora_type: loraDetails.loraType,
          lora_base_model: loraDetails.model,
          model_variant: loraDetails.modelVariant,
          lora_link: finalLoraLinkToUse || null,
          download_link: directDownloadUrlToSave || null,
          admin_status: 'Listed',
          user_status: 'Listed'
        })
        .select()
        .single();

      if (assetError) {
        logger.error('Error creating asset:', assetError);
        throw new Error(`Failed to create asset: ${assetError.message}`);
      }

      assetId = assetData.id;
      logger.log(`Asset created successfully with ID: ${assetId}`);
      setCurrentStepMsg('LoRA asset created. Processing example media...');

      // Step 2: Process and link each video
      const processedVideos = [];
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        if (!video.url) continue; 

        const videoName = video.metadata.title || `Example Media ${i + 1}`;
        setCurrentStepMsg(`Processing ${videoName}...`);
        const videoUrl = video.url;

        try {
          setCurrentStepMsg(`Generating thumbnail for ${videoName}...`);
          logger.log(`Generating thumbnail for video: ${video.metadata.title || 'Untitled'}`);
          const thumbnailUrl = await thumbnailService.generateThumbnail(videoUrl);
          logger.log(`Thumbnail generated for ${video.metadata.title || 'Untitled'}: ${thumbnailUrl ? 'Success' : 'Failed'}`);

          const aspectRatio = await getVideoAspectRatio(videoUrl);
          logger.log(`Calculated aspect ratio for ${video.metadata.title}: ${aspectRatio}`);
          
          setCurrentStepMsg(`Saving ${videoName} to database...`);
          logger.log(`Creating media entry for video ${video.metadata.title || 'Untitled'}`);
          const { data: mediaData, error: mediaError } = await supabase
            .from('media')
            .insert({
              title: video.metadata.title || '',
              url: videoUrl,
              type: 'video',
              classification: video.metadata.classification || 'art',
              user_id: user?.id || null,
              placeholder_image: thumbnailUrl,
              metadata: { aspectRatio: aspectRatio },
              admin_status: 'Listed',
              user_status: 'Listed'
            })
            .select()
            .single();

          if (mediaError) {
            logger.error(`Error creating media entry for ${video.metadata.title}:`, mediaError);
            console.error('Error creating media entry:', mediaError);
            continue; // Skip to the next video if media creation fails
          }

          if (!mediaData) {
            logger.warn(`No media data returned after insertion for ${video.metadata.title}`);
            console.error('No media data returned after insertion');
            continue;
          }

          const mediaId = mediaData.id;
          logger.log(`Created media with ID: ${mediaId} for ${video.metadata.title}`);
          setCurrentStepMsg(`${videoName} saved. Linking to LoRA...`);

          // Determine if this video is primary
          const isPrimary = video.metadata.isPrimary || (!primaryMediaId && video === videos[0]);
          if (isPrimary && !primaryMediaId) {
            primaryMediaId = mediaId;
            logger.log(`Set primary media ID: ${primaryMediaId}`);
            setCurrentStepMsg(`Set primary media ID: ${primaryMediaId}`);
          }

          // Link asset and media
          setCurrentStepMsg(`Linking ${videoName} to LoRA asset...`);
          logger.log(`Linking asset ${assetId} with media ${mediaId}`);
          const { error: linkError } = await supabase
            .from('asset_media')
            .insert({ asset_id: assetId, media_id: mediaId });

          if (linkError) {
            logger.error(`Error linking asset ${assetId} and media ${mediaId}:`, linkError);
            console.error('Error linking asset and media:', linkError);
          } else {
            logger.log(`Linked asset ${assetId} with media ${mediaId}`);
            processedVideos.push(mediaId);
          }
        } catch (mediaProcessingError) {
          logger.error(`Error processing media ${video.metadata.title}:`, mediaProcessingError);
          console.error(`Error processing media ${video.metadata.title}:`, mediaProcessingError);
        }
      }

      // Step 3: Update asset with primary media ID if found
      if (primaryMediaId && assetId) {
        setCurrentStepMsg('Setting primary media for LoRA...');
        logger.log(`Updating asset ${assetId} with primary media ${primaryMediaId}`);
        const { error: updateError } = await supabase
          .from('assets')
          .update({ primary_media_id: primaryMediaId })
          .eq('id', assetId);

        if (updateError) {
          logger.error(`Error updating asset ${assetId} with primary media:`, updateError);
          console.error('Error updating asset with primary media:', updateError);
        } else {
          logger.log(`Updated asset ${assetId} with primary media ${primaryMediaId}`);
          setCurrentStepMsg('Updated asset with primary media.');
        }
      } else {
        logger.warn(`Warning: No primary media ID set or determined for asset ${assetId}`);
      }

      setCurrentStepMsg('Finalizing submission details...');
      logger.log(`Asset creation and video submission completed. Summary: assetId=${assetId}, primaryMediaId=${primaryMediaId}, videos=${processedVideos.length}`);

      return { assetId };

    } catch (error) {
      logger.error('Exception during asset creation or video submission process:', error);
      setCurrentStepMsg('An error occurred while saving data.');
      return { assetId: null };
    }
  };
  
  return (
    <div className={`flex flex-col ${hideLayout ? '' : 'min-h-screen bg-background'}`}>
      {!hideLayout && <Navigation />}
      
      <main className={`flex-1 ${hideLayout ? 'p-0' : 'container mx-auto p-4'}`}>
        {!hideLayout && (
          <>
            <h1 className="text-3xl font-bold tracking-tight mb-4">Add LoRA or Media</h1>
            <p className="text-muted-foreground mb-8">
              Submit a LoRA you made, or media generated with existing LoRAs.
            </p>
          </>
        )}
        
        {!user && (
          <Alert className="mb-8 border border-olive/20 bg-cream-light text-foreground font-body">
            <AlertTitle className="font-heading font-medium">You must be signed in to submit.</AlertTitle>
            <AlertDescription className="mt-1 font-body">
              Please <Link to="/auth" className="font-medium text-olive hover:text-olive-dark underline">sign in</Link>.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {(!hideModeSelector) && (
            <div className="mb-8 p-6 border rounded-lg bg-card">
              <Label className="text-sm font-medium mb-2 block">What would you like to upload?</Label>
              <RadioGroup value={uploadMode} onValueChange={(v) => setUploadMode(v as 'lora' | 'media')} className="flex gap-4" >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lora" id="mode-lora" />
                  <Label htmlFor="mode-lora" className="cursor-pointer">LoRA</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="media" id="mode-media" />
                  <Label htmlFor="mode-media" className="cursor-pointer">Media</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          {uploadMode === 'lora' && !finalForcedLoraId && (
            <div className="p-6 border rounded-lg bg-card space-y-4">
              <h2 className="text-xl font-semibold">LoRA Details</h2>
              <LoRADetailsForm 
                loraDetails={loraDetails} 
                updateLoRADetails={updateLoRADetails}
                onLoraFileSelect={setLoraFile}
                disabled={!user} 
              />
            </div>
          )}
          
          <div className="p-6 border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-semibold">Videos</h2>
            <MultipleVideoUploader 
              videos={videos} 
              setVideos={setVideos} 
              disabled={!user}
              hideIsPrimary={uploadMode === 'media'}
              defaultClassification={finalDefaultClassification}
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <Button type="submit" disabled={isSubmitting || !user} size={isMobile ? "sm" : "default"}>
              {isSubmitting ? 'Submitting...' : (uploadMode === 'lora' ? 'Submit LoRA' : 'Submit Media')}
            </Button>
            {isSubmitting && currentStepMessage && (
              <p className="text-sm text-muted-foreground animate-pulse">{currentStepMessage}</p>
            )}
          </div>
        </form>
      </main>
      
      {!hideLayout && <Footer />}
    </div>
  );
};

// Helper function used in mapping HF URLs back to original videos
// Needs to be accessible within handleSubmit or defined globally/imported
function sanitizeRepoName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-._]/g, '') // Remove invalid characters
    .replace(/--+/g, '-') // Replace multiple hyphens with a single one
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
}

// Helper function to generate README.md content
// This function should be defined outside handleSubmit, e.g., at the bottom of the file or imported
const generateReadmeContent = (
  loraDetails: LoRADetails, 
  videoWidgets: { text: string, output: { url: string } }[],
  openMuseUrl?: string // Optional OpenMuse URL to append
): string => {
  const modelTitle = `${loraDetails.model} (${loraDetails.modelVariant || ''})`;
  
  let widgetSection = '';
  if (videoWidgets && videoWidgets.length > 0) {
    widgetSection = videoWidgets.map(v => {
      const promptText = v.text.trim().replace(/\n/g, '\n      ');
      return (
`  - text: |
      ${promptText}
    output:
      url: ${v.output.url}`
      );
    }).join('\n');
  }

  const readmeFrontMatter = `
base_model:
- Lightricks/LTX-Video
${widgetSection ? `widget:\n${widgetSection}\n` : ''}tags:
- ltxv
- 13B
- text-to-video
- lora
`.trimStart();

  const userDescription = loraDetails.loraDescription || 'No description provided.';
  let openMuseLinkSection = '';
  if (openMuseUrl) {
    openMuseLinkSection = `

---
Find this LoRA on OpenMuse: [${openMuseUrl}](${openMuseUrl})
`;
  }
  return `---
${readmeFrontMatter}---

# ${modelTitle}

<Gallery />

## Description:
${userDescription}
${openMuseLinkSection}
`;
};

export default UploadPage;
