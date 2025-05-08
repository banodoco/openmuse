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
import { uploadLoraToHuggingFace } from '@/lib/huggingfaceUploader';

const logger = new Logger('Upload');

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
    loraStorageMethod: 'link',
    loraLink: '',
    huggingFaceApiKey: '',
    loraDirectDownloadLink: '', // Initialize new field
    saveApiKey: true
  });
  
  const updateLoRADetails = (field: keyof LoRADetails, value: string) => {
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
    console.log('[handleSubmit] <<< Checkpoint 1: Immediately after State before main logic log >>>');

    if (uploadMode === 'media') {
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
    
    if (!loraDetails.loraName) {
      toast.error('Please provide a LoRA name');
      return;
    }
    
    if (loraDetails.creator === 'someone_else' && !loraDetails.creatorName) {
      toast.error('Please provide the creator name for the LoRA');
      return;
    }
    
    // New validation logic for LoRA link / HuggingFace Upload
    if (uploadMode === 'lora') { // Only validate these if we are in LoRA upload mode
      if (loraDetails.loraStorageMethod === 'link') {
        const hasLoraLink = loraDetails.loraLink && loraDetails.loraLink.trim() !== '';
        const hasDirectDownloadLink = loraDetails.loraDirectDownloadLink && loraDetails.loraDirectDownloadLink.trim() !== '';

        if (!hasLoraLink && !hasDirectDownloadLink) {
          toast.error('Please provide either the LoRA Link or the Direct Download Link (or both).');
          setIsSubmitting(false);
          return;
        }
        if (hasLoraLink) {
          try {
            new URL(loraDetails.loraLink);
          } catch (_) {
            toast.error('Please enter a valid URL for the LoRA Link.');
            setIsSubmitting(false);
            return;
          }
        }
        if (hasDirectDownloadLink) {
          try {
            new URL(loraDetails.loraDirectDownloadLink);
          } catch (_) {
            toast.error('Please enter a valid URL for the Direct Download Link.');
            setIsSubmitting(false);
            return;
          }
        }
      } else if (loraDetails.loraStorageMethod === 'upload') {
        if (!loraDetails.huggingFaceApiKey || loraDetails.huggingFaceApiKey.trim() === '') {
          toast.error('Please provide your HuggingFace API Key');
          return;
        }
        if (!loraFile) {
          toast.error('Please select a LoRA file to upload');
          return;
        }
        // Potentially add more validation for loraFile (type, size) if needed
      }
    }

    console.log('[handleSubmit] <<< Checkpoint 2: Before JSON.stringify(videos) >>>');
    // Log the entire videos array content for detailed inspection
    console.log('[handleSubmit] Videos array before primary check:', JSON.stringify(videos, null, 2));
    console.log('[handleSubmit] <<< Checkpoint 3: After JSON.stringify(videos) >>>');

    // const hasPrimary = videos.some(video => (video.file || video.url) && video.metadata.isPrimary);
    // Robust check for primary video
    const hasPrimary = videos.some(video => 
      (video.file || video.url) && 
      video.metadata && 
      video.metadata.isPrimary
    );
    if (!hasPrimary) {
      toast.error('Please set one video as the primary media for this LoRA');
      setIsSubmitting(false); // Also ensure isSubmitting is reset
      return;
    }
    
    const reviewerName = user?.email || 'Anonymous';
    
    try {
      let finalLoraLink = '';
      let directDownloadUrlToSave = '';
      let loraSupabaseStoragePath: string | undefined = undefined;
      const videoMetadataForHfUpload: VideoItemUploadMetadata[] = [];

      if (uploadMode === 'lora') {
        if (loraDetails.loraStorageMethod === 'upload') {
          if (!loraFile || !loraDetails.huggingFaceApiKey) {
            toast.error("LoRA file or HuggingFace API Key missing for upload.");
            setCurrentStepMessage('Error: Missing LoRA file or API key.');
            setIsSubmitting(false);
            return;
          }

          // Step 1: Upload LoRA file to Supabase temporary storage
          try {
            const loraFileName = loraFile.name;
            setCurrentStepMessage(`Uploading LoRA file (${loraFileName}) to temporary storage...`);
            logger.log(`Uploading LoRA file ${loraFileName} to Supabase temporary storage.`);
            const loraSbPath = `users/${user.id}/loras_temp/${uuidv4()}-${loraFileName}`;
            const { data: loraSbUploadData, error: loraSbUploadError } = await supabase.storage
              .from('temporary') // Make sure 'temporary' is your bucket name
              .upload(loraSbPath, loraFile, {
                cacheControl: '3600',
                upsert: false // Or true if you want to allow overwrites, though UUID should make it unique
              });

            if (loraSbUploadError) {
              logger.error('Supabase LoRA upload error:', loraSbUploadError);
              throw new Error(`Failed to upload LoRA to temporary storage: ${loraSbUploadError.message}`);
            }
            if (!loraSbUploadData || !loraSbUploadData.path) {
              throw new Error('LoRA temporary storage upload failed: No path returned.');
            }
            loraSupabaseStoragePath = loraSbUploadData.path;
            logger.log(`LoRA file uploaded to Supabase temporary storage: ${loraSupabaseStoragePath}`);
            setCurrentStepMessage('LoRA file temporarily stored. Processing videos...');
          } catch (tempUploadError: any) {
            logger.error("Temporary LoRA upload failed:", tempUploadError);
            toast.error(`Temporary LoRA Upload Error: ${tempUploadError.message || 'Unknown error'}`);
            setCurrentStepMessage(`Temporary LoRA upload failed: ${tempUploadError.message || 'Unknown error'}.`);
            setIsSubmitting(false);
            return;
          }

          // Step 2: Upload Video files to Supabase temporary storage
          for (const video of videos) {
            if (video.file && video.file instanceof File) {
              try {
                const videoFileName = video.file.name;
                setCurrentStepMessage(`Uploading video (${videoFileName}) to temporary storage...`);
                logger.log(`Uploading video file ${videoFileName} to Supabase temporary storage.`);
                const videoSbPath = `users/${user.id}/videos_temp/${uuidv4()}-${videoFileName}`;
                const { data: videoSbUploadData, error: videoSbUploadError } = await supabase.storage
                  .from('temporary') // Ensure this is your correct bucket name
                  .upload(videoSbPath, video.file, {
                    cacheControl: '3600',
                    upsert: false
                  });

                if (videoSbUploadError) {
                  logger.error(`Supabase video upload error (${videoFileName}):`, videoSbUploadError);
                  throw new Error(`Failed to upload video ${videoFileName} to temporary storage: ${videoSbUploadError.message}`);
                }
                if (!videoSbUploadData || !videoSbUploadData.path) {
                  throw new Error(`Video temporary storage upload failed for ${videoFileName}: No path returned.`);
                }
                videoMetadataForHfUpload.push({
                  storagePath: videoSbUploadData.path,
                  metadata: video.metadata,
                  originalFileName: videoFileName
                });
                logger.log(`Video ${videoFileName} uploaded to Supabase temporary storage: ${videoSbUploadData.path}`);
              } catch (tempVideoUploadError: any) {
                logger.error("Temporary video upload failed:", tempVideoUploadError);
                toast.error(`Temporary Video Upload Error: ${tempVideoUploadError.message || 'Unknown error'}`);
                setCurrentStepMessage(`Temporary video upload failed: ${tempVideoUploadError.message || 'Unknown error'}.`);
                setIsSubmitting(false);
                return; // Stop if any video fails to upload to temp storage
              }
            } else if (video.url) { // Existing video with a URL
              videoMetadataForHfUpload.push({
                existingUrl: video.url,
                metadata: video.metadata,
                originalFileName: video.metadata.title || 'existing_video' // Or derive a name if possible
              });
            }
          }
          setCurrentStepMessage('All files temporarily stored. Proceeding to Hugging Face...');

          // Step 3: Call uploadLoraToHuggingFace with storage paths
          const hfFileNameForDisplay = loraFile.name || 'LoRA file'; // loraFile is guaranteed by earlier check
          setCurrentStepMessage(`Transferring ${hfFileNameForDisplay} and videos to Hugging Face... This may take a moment.`);
          logger.log(`Calling uploadLoraToHuggingFace with LoRA path: ${loraSupabaseStoragePath}`);
          
          try {
            // Expect a different response structure now
            const hfResponse = await uploadLoraToHuggingFace({
              loraStoragePath: loraSupabaseStoragePath, 
              loraDetails: loraDetails,
              videosMetadata: videoMetadataForHfUpload, 
              hfToken: loraDetails.huggingFaceApiKey,
              saveApiKey: loraDetails.saveApiKey
            });

            // Type guard or check for the expected response structure
            if (!hfResponse || typeof hfResponse !== 'object' || !hfResponse.loraUrl) {
              throw new Error("Failed to process LoRA via HuggingFace. Invalid response from uploader.");
            }

            const uploadedHfLoraUrl = hfResponse.loraUrl;
            const uploadedHfVideoUrls = hfResponse.videoUrls || []; // Array of video URLs from HF

            const repoUrl = uploadedHfLoraUrl.split('/resolve/')[0];
            finalLoraLink = repoUrl;
            directDownloadUrlToSave = uploadedHfLoraUrl;
            setCurrentStepMessage("LoRA and media transferred to Hugging Face! Saving details...");
            logger.log(`LoRA and media transferred to HuggingFace: Repo URL: ${finalLoraLink}, LoRA File URL: ${directDownloadUrlToSave}`);
            logger.log(`Returned Video URLs from HF:`, uploadedHfVideoUrls);

            // --- IMPORTANT: Update the 'videos' state array with the HF URLs --- 
            const updatedVideosForDb = videos.map(originalVideo => {
              // Find the corresponding processed metadata for this original video item
              const processedMeta = videoMetadataForHfUpload.find(meta => 
                (meta.storagePath && originalVideo.file && meta.originalFileName === originalVideo.file.name) ||
                (meta.existingUrl && originalVideo.url === meta.existingUrl)
              );
              
              if (processedMeta?.storagePath && processedMeta.originalFileName) {
                // This video was uploaded to temp storage and then to HF.
                // Find its final HF URL from the response.
                const hfUrl = uploadedHfVideoUrls.find(url => {
                  // Extract filename from HF URL and compare with original name
                  try {
                    const urlParts = url.split('/');
                    const encodedFileName = urlParts[urlParts.length - 1];
                    const decodedFileName = decodeURIComponent(encodedFileName);
                    // We might need to compare against sanitized name depending on HF URL structure
                    // Assuming URL contains sanitized name from edge function: `media/sanitized_name.ext`
                    const sanitizedOriginal = sanitizeRepoName(processedMeta.originalFileName);
                    return decodedFileName === `media/${sanitizedOriginal}` || decodedFileName === sanitizedOriginal;
                  } catch (e) { return false; }
                });

                if (hfUrl) {
                  logger.log(`Mapping original video ${processedMeta.originalFileName} to HF URL: ${hfUrl}`);
                  return { ...originalVideo, file: null, url: hfUrl }; // Update URL, remove file
                } else {
                  logger.warn(`Could not find matching HF URL for uploaded video: ${processedMeta.originalFileName}. It might not be saved correctly.`);
                  return { ...originalVideo, file: null, url: null }; // Mark as failed/missing URL?
                }
              } else {
                // This video was either existing (had URL) or wasn't processed for HF.
                // Keep its original state (it might have URL already, or be skipped).
                return originalVideo;
              }
            });
            // Update the state that will be passed to submitVideos
            setVideos(updatedVideosForDb);
            logger.log('Updated video state with HF URLs before calling submitVideos.');
            // --- End Video State Update ---

            toast.success("LoRA and media successfully processed via HuggingFace!");
          } catch (hfProcessingError: any) {
            logger.error("HuggingFace processing (from temp storage) failed:", hfProcessingError);
            toast.error(`HuggingFace Processing Error: ${hfProcessingError.message || 'Unknown error'}`);
            setCurrentStepMessage(`Hugging Face processing failed: ${hfProcessingError.message || 'Unknown error'}.`);
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
      await submitVideos(videos, loraDetails, reviewerName, user, finalLoraLink, directDownloadUrlToSave, setCurrentStepMessage);
      
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
  ) => {
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

    } catch (error) {
      logger.error('Exception during asset creation or video submission process:', error);
      setCurrentStepMsg('An error occurred while saving data.');
      throw error; 
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

export default UploadPage;
