import React, { useState, useEffect } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import { toast } from 'sonner';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { MultipleVideoUploader, AssetDetailsForm } from './components';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { VideoItem, AssetType, VideoEntry, VideoMetadata as VideoItemMetadata } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import HuggingFaceService, { type HuggingFaceRepoInfo } from '@/lib/services/huggingfaceService';
import { isValidVideoUrl, isValidImageUrl } from '@/lib/utils/videoUtils';
import { uploadMultipleVideosToCloudflare, createMediaFromExistingVideo } from '@/lib/services/videoUploadService';

const logger = new Logger('Upload');

// Helper function to safely stringify objects
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

// Define the AssetDetails type (generalized from LoRADetails)
export interface AssetDetails {
  name: string; // Changed from loraName
  description: string; // Changed from loraDescription
  creator: 'self' | 'someone_else';
  creatorName: string;
  
  // LoRA specific fields (optional)
  model?: string;
  modelVariant?: string;
  loraType?: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Control' | 'Other';
  loraStorageMethod?: 'upload' | 'link';
  loraLink?: string;
  huggingFaceApiKey?: string;
  loraDirectDownloadLink?: string;
  saveApiKey?: boolean;

  // Workflow specific fields (optional for now, can be expanded)
  // workflowFormat?: string; 
}

// New interface for video metadata when passing to huggingfaceUploader (remains the same)
export interface VideoItemUploadMetadata {
  storagePath?: string; 
  existingUrl?: string; 
  metadata: any; 
  originalFileName?: string; 
}

interface UploadPageProps {
  initialMode?: 'lora' | 'media' | 'workflow'; // Added 'workflow'
  forcedLoraId?: string; // This might become forcedAssetId if generalized further
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
  
  const [loraFile, setLoraFile] = useState<File | null>(null); // For LoRA file
  const [workflowFile, setWorkflowFile] = useState<File | null>(null); // For Workflow file
  
  const [assetDetails, setAssetDetails] = useState<AssetDetails>({
    name: '',
    description: '',
    creator: 'self',
    creatorName: '',
    // LoRA specific defaults (will be ignored if not lora mode)
    model: '',
    modelVariant: '',
    loraType: 'Concept',
    loraStorageMethod: 'upload',
    loraLink: '',
    huggingFaceApiKey: '',
    loraDirectDownloadLink: '',
    saveApiKey: true
  });
  
  const updateAssetDetails = (field: keyof AssetDetails, value: string | boolean) => {
    setAssetDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const [videos, setVideos] = useState<any[]>([]);
  
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialModeParam = searchParams.get('mode');
  const forcedLoraIdParam = searchParams.get('loraId');
  const classificationParam = searchParams.get('classification');

  const finalInitialMode = initialModeProp ?? 
    (initialModeParam === 'media' ? 'media' : 
    (initialModeParam === 'lora' ? 'lora' : 
    (initialModeParam === 'workflow' ? 'workflow' : undefined))); // Added workflow

  const finalForcedLoraId = forcedLoraIdProp ?? forcedLoraIdParam;
  const finalDefaultClassification: 'art' | 'gen' = defaultClassificationProp ?? ((classificationParam === 'art' || classificationParam === 'gen') ? classificationParam : 'gen');

  const defaultMode: 'lora' | 'media' | 'workflow' = (finalForcedLoraId || finalInitialMode === 'media') 
    ? 'media' 
    : (finalInitialMode === 'workflow' ? 'workflow' : 'lora'); // Adjusted default

  const [uploadMode, setUploadMode] = useState<'lora' | 'media' | 'workflow'>(defaultMode);
  const hideModeSelector = !!finalForcedLoraId || !!finalInitialMode;

  const [availableLoras, setAvailableLoras] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchLoras = async () => {
      if (uploadMode !== 'media' || finalForcedLoraId) return;
      const { data, error } = await supabase
        .from('assets')
        .select('id, name')
        .or('type.eq.lora,type.eq.LoRA'); // Keep this specific to LoRAs for media association
      if (!error && data) {
        setAvailableLoras(data as { id: string; name: string }[]);
      }
    };
    fetchLoras();
  }, [uploadMode, finalForcedLoraId]);

  useEffect(() => {
    // Only run this effect for LoRA uploads that use HuggingFace
    if (uploadMode !== 'lora' || assetDetails.loraStorageMethod !== 'upload') {
        // If not in LoRA upload mode or not using HF, clear any potentially fetched API key
        if (assetDetails.huggingFaceApiKey) {
            // updateAssetDetails('huggingFaceApiKey', ''); // Avoid potential loops by not calling setter if not needed
        }
        return;
    }
    
    console.log('[API Key Effect RUNNING for LORA] User:', !!user, 'Storage Method:', assetDetails.loraStorageMethod, 'Current Key:', assetDetails.huggingFaceApiKey);
    const fetchAndSetApiKey = async () => {
      if (user) {
        console.log('[API Key Effect LORA Condition MET] User and Upload method. Current Key:', assetDetails.huggingFaceApiKey);
        if (assetDetails.huggingFaceApiKey && assetDetails.huggingFaceApiKey.startsWith('hf_')) {
            console.log('[API Key Effect LORA] Key already present or being entered, skipping fetch.');
            return;
        }

        console.log('[API Key Effect LORA] Upload method selected, attempting to fetch saved API key for user:', user.id);
        try {
          const { data, error } = await supabase
            .from('api_keys')
            .select('key_value')
            .eq('user_id', user.id)
            .eq('service', 'huggingface')
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error('[API Key Effect LORA] Error fetching API key:', error);
            toast.error('Could not fetch your saved Hugging Face API key.');
          } else if (data && data.key_value) {
            console.log('[API Key Effect LORA] Successfully fetched API key. Updating assetDetails.');
            updateAssetDetails('huggingFaceApiKey', data.key_value);
          } else {
            console.log('[API Key Effect LORA] No saved Hugging Face API key found for this user.');
          }
        } catch (e) {
          console.error('[API Key Effect LORA] Exception during API key fetch:', e);
          toast.error('An unexpected error occurred while fetching your API key.');
        }
      }
    };

    fetchAndSetApiKey();
  }, [user, uploadMode, assetDetails.loraStorageMethod]); // Depends on uploadMode now

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    logger.log('[handleSubmit] Triggered for mode:', uploadMode);
    
    if (!user) {
      toast.error('You must be signed in to submit');
      navigate('/auth');
      return;
    }
    
    const videosToProcess = videos.filter(video => video.file || video.url);
    if (videosToProcess.length === 0) {
      toast.error('Please add at least one video (file or link).');
      return;
    }
    
    setIsSubmitting(true);
    setCurrentStepMessage('Preparing submission...');

    logger.log('[handleSubmit] State before main logic:', { 
      uploadMode, 
      loraFile: loraFile ? { name: loraFile.name, size: loraFile.size, type: loraFile.type } : null,
      workflowFile: workflowFile ? { name: workflowFile.name, size: workflowFile.size, type: workflowFile.type } : null,
      assetDetails, 
      videos: videosToProcess 
    });

    try {
      let uploadedVideoEntries: VideoEntry[] = [];
      const videosFromFile: { file: File, metadata: VideoItemMetadata }[] = [];
      const videosFromUrl: VideoItem[] = [];

      videosToProcess.forEach(video => {
        if (video.file && video.metadata) {
          videosFromFile.push({ file: video.file, metadata: video.metadata as VideoItemMetadata });
        } else if (video.url && video.metadata) {
          videosFromUrl.push(video);
        }
      });

      if (videosFromFile.length > 0) {
        setCurrentStepMessage(`Uploading ${videosFromFile.length} video file(s) to Cloudflare Stream...`);
        const onUploadProgress = (videoName: string, bytesUploaded: number, bytesTotal: number, videoIndex: number, totalVideos: number) => {
          const progressPercent = totalVideos > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
          setCurrentStepMessage(`Uploading ${videoName} (${videoIndex + 1}/${totalVideos}): ${progressPercent}%`);
        };
        
        const results = await uploadMultipleVideosToCloudflare(videosFromFile, user.id, undefined, onUploadProgress);
        results.forEach(result => {
          if (result.status === 'success') {
            uploadedVideoEntries.push(result.entry);
            // Find the original VideoItem to mark it as "primary" if needed for submitAssetData
            const originalVideoItem = videos.find(v => (v.file?.name === result.title && v.file?.type === videosFromFile.find(vf => vf.metadata.title === result.entry.title)?.file.type) || v.metadata?.title === result.entry.title);
            if (originalVideoItem?.metadata?.isPrimary) {
               // Ensure the VideoEntry reflects this, or handle in submitAssetData
               // For now, we assume `submitAssetData` will use `originalVideoItem.metadata.isPrimary`
            }
          } else {
            toast.error(`Failed to upload ${result.title}: ${result.error}`);
            logger.error(`[VideoLoadSpeedIssue] Failed to upload ${result.title} to Cloudflare:`, result.error);
          }
        });
        
        if (uploadedVideoEntries.length !== videosFromFile.length) {
            // Handle partial failure: decide if to proceed or stop
            toast.error("Some videos failed to upload. Check console for details.");
            // Optionally, throw an error to stop submission if all uploads must succeed
            // throw new Error("Not all videos could be uploaded to Cloudflare.");
        }
        setCurrentStepMessage('Video file(s) processed by Cloudflare Stream.');
      }

      // Process videos from URL (if any) - these will be created as media entries later or by createMediaFromExistingVideo
      // For now, we will pass them to submitAssetData and it can decide how to handle them.
      // Or, ideally, we create them here if they are plain URLs.
      for (const videoFromUrl of videosFromUrl) {
          if (videoFromUrl.url && videoFromUrl.metadata && user) {
              setCurrentStepMessage(`Processing existing video URL: ${videoFromUrl.metadata.title || videoFromUrl.url}`);
              try {
                // If it's a Cloudflare URL already, we might just need to ensure DB entry exists.
                // Otherwise, create a new media entry.
                const existingVideoEntry = await createMediaFromExistingVideo(
                    videoFromUrl.metadata as VideoItemMetadata, // Cast needed
                    user.id,
                    videoFromUrl.url,
                    undefined // assetId - will be linked later if part of an asset
                );
                if (existingVideoEntry) {
                    uploadedVideoEntries.push(existingVideoEntry);
                } else {
                    toast.error(`Could not process existing video URL: ${videoFromUrl.metadata.title}`);
                }
              } catch (e: any) {
                  logger.error(`[VideoLoadSpeedIssue] Error processing existing video URL ${videoFromUrl.url}:`, e.message);
                  toast.error(`Error with URL ${videoFromUrl.metadata.title || videoFromUrl.url}: ${e.message}`);
              }
          }
      }
      
      if (uploadMode === 'media') {
        // MEDIA ONLY FLOW
        setCurrentStepMessage('Finalizing media submission...');
        if (uploadedVideoEntries.length === 0 && videosFromUrl.length === 0) {
          toast.error('No videos were successfully processed.');
          setIsSubmitting(false);
          return;
        }

        // If media is associated with an existing asset (e.g. finalForcedLoraId)
        if (finalForcedLoraId && uploadedVideoEntries.length > 0) {
          setCurrentStepMessage('Linking media to asset...');
          for (const entry of uploadedVideoEntries) {
            const originalVideoItem = videos.find(v => v.metadata?.title === entry.title || (v.file && v.file.name === entry.title)); // Match by title or filename
            const { error: linkError } = await supabase
              .from('asset_media')
              .insert({ asset_id: finalForcedLoraId, media_id: entry.id, status: 'Listed' }); // Make sure entry.id is the media_id
            if (linkError) {
              logger.error(`[VideoLoadSpeedIssue] Error linking media ${entry.id} to asset ${finalForcedLoraId}:`, linkError);
              toast.error(`Failed to link ${entry.title} to asset.`);
            }
            if (originalVideoItem?.metadata?.isPrimary) { // Check original item for isPrimary flag
              await supabase.from('assets').update({ primary_media_id: entry.id }).eq('id', finalForcedLoraId);
            }
          }
        }
        toast.success('Media submitted successfully!');
        if (onSuccess) onSuccess();
        setIsSubmitting(false);
        // Potentially navigate or clear form
        if (finalForcedLoraId) {
            navigate(`/assets/loras/${finalForcedLoraId}`); // Or a generic asset page
        } else {
            // navigate somewhere else or clear form
        }
        return;
      }

      // ASSET (LoRA or Workflow) FLOW
      if (!assetDetails.name) {
        toast.error('Please provide a name for the asset');
        setIsSubmitting(false);
        return;
      }
      if (assetDetails.creator === 'someone_else' && !assetDetails.creatorName) {
        toast.error('Please provide the creator name');
        setIsSubmitting(false);
        return;
      }

      // Check if at least one of the successfully uploaded/processed videos is primary
      const hasPrimaryAmongProcessed = videosToProcess.some(v => 
        v.metadata?.isPrimary && 
        uploadedVideoEntries.find(ue => ue.title === v.metadata?.title || (v.file && v.file.name === ue.title))
      );

      if (!hasPrimaryAmongProcessed) {
        toast.error('Please ensure one of the successfully processed videos is set as primary for this asset.');
        setIsSubmitting(false);
        return;
      }
      
      const reviewerName = user?.email || 'Anonymous';
      let finalAssetLink = '';
      let directDownloadUrlToSave = '';

      if (uploadMode === 'lora') {
        logger.log('Processing LORA submission...');
        // ... (LoRA specific validation and HF processing - largely unchanged, ensure it uses assetDetails)
        // This part sets finalAssetLink and directDownloadUrlToSave
        // For brevity, the HuggingFace interaction logic is not repeated here but assumed to be correct.
        // Ensure that setCurrentStepMessage is used appropriately within this block.
        if (assetDetails.loraStorageMethod === 'upload' && loraFile && assetDetails.huggingFaceApiKey) {
            setCurrentStepMessage('Processing LoRA with Hugging Face...');
            const hfService = new HuggingFaceService(assetDetails.huggingFaceApiKey);
            const repoName = sanitizeRepoName(assetDetails.name) || `lora-model-${uuidv4().substring(0,8)}`;
            const repoInfo = await hfService.createOrGetRepo(repoName);
            finalAssetLink = repoInfo.url;
            const loraFileNameInRepo = loraFile.name;
            await hfService.uploadRawFile({
                  repoIdString: repoInfo.repoIdString,
                  fileContent: loraFile,
                pathInRepo: loraFileNameInRepo,
                  commitTitle: `Upload LoRA file: ${loraFileNameInRepo}`
                });
            directDownloadUrlToSave = `${repoInfo.url}/resolve/main/${encodeURIComponent(loraFileNameInRepo)}`;
            
            // README generation might need URLs of videos uploaded to HF if that's part of the flow
            // For now, it's simplified.
            const readmeContent = generateReadmeContent(assetDetails, [], undefined); // Pass empty video widgets for now
            await hfService.uploadTextAsFile({
                repoIdString: repoInfo.repoIdString,
                textData: readmeContent,
                pathInRepo: 'README.md',
                commitTitle: 'Add LoRA model card'
            });
            setCurrentStepMessage('LoRA processed with Hugging Face.');
        } else if (assetDetails.loraStorageMethod === 'link') {
            finalAssetLink = assetDetails.loraLink || '';
            directDownloadUrlToSave = assetDetails.loraDirectDownloadLink || assetDetails.loraLink || '';
        }
      } else if (uploadMode === 'workflow') {
        logger.log('Processing WORKFLOW submission...');
        // ... (Workflow file upload to Supabase storage - largely unchanged)
        // This part sets directDownloadUrlToSave
        if (!workflowFile) {
          toast.error('Please select a workflow file to upload.');
          setIsSubmitting(false); return; 
        }
        if (!workflowFile.name.toLowerCase().endsWith('.json')) {
          toast.error('Only JSON files are supported for workflows.');
          setIsSubmitting(false); return;
        }
        setCurrentStepMessage('Uploading workflow file...');
        const fileName = `${user.id}/${uuidv4()}-${workflowFile.name}`;
        const { data: workflowUploadData, error: workflowUploadError } = await supabase.storage
          .from('workflows')
          .upload(fileName, workflowFile, { cacheControl: '3600', upsert: false });

        if (workflowUploadError) {
          logger.error('Error uploading workflow file:', workflowUploadError);
          toast.error(`Failed to upload workflow file: ${workflowUploadError.message}`);
          setIsSubmitting(false); return;
        }
        const { data: publicUrlData } = supabase.storage.from('workflows').getPublicUrl(fileName);
        if (!publicUrlData?.publicUrl) {
            logger.error('Could not get public URL for workflow file:', fileName);
            toast.error('Failed to get workflow file URL. Please try again.');
            setIsSubmitting(false); return; 
        }
        directDownloadUrlToSave = publicUrlData.publicUrl;
        finalAssetLink = ''; // Or construct a link like /assets/workflows/{assetId} later
        setCurrentStepMessage('Workflow file uploaded.');
      }
      
      setCurrentStepMessage('Saving asset and linking media details to database...');
      // Pass original `videos` array for isPrimary check, and `uploadedVideoEntries` for actual media IDs
      const assetCreationResult = await submitAssetData(
        videos, // Original videos array to check for .metadata.isPrimary
        uploadedVideoEntries, // Successfully processed video entries from Cloudflare or URL processing
        assetDetails, 
        uploadMode,
        reviewerName, 
        user, 
        finalAssetLink, 
        directDownloadUrlToSave, 
        setCurrentStepMessage
      );
      
      if (assetCreationResult && assetCreationResult.assetId) {
        // Post-submission README update for LoRAs (if applicable)
        // This part might need a valid hfService and repoInfo from the LORA upload block
        // Ensure this logic is still sound and has access to necessary HF variables if re-enabled.
        const assetTypeName = uploadMode.charAt(0).toUpperCase() + uploadMode.slice(1);
        toast.success(`${assetTypeName} submitted successfully!`);
        if (onSuccess) onSuccess();
        navigate(`/assets/${uploadMode === 'lora' ? 'loras' : 'workflows'}/${assetCreationResult.assetId}`);
      } else {
        toast.error('Failed to create asset. Please check details and try again.');
      }

    } catch (error: any) {
      console.error('[VideoLoadSpeedIssue] Error submitting form:', error);
      logger.error('Error submitting form:', { error, message: error?.message, stack: error?.stack });
      toast.error(error.message || 'Failed to submit');
      setCurrentStepMessage('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Generalized function to submit asset data
  const submitAssetData = async (
    originalVideoItems: VideoItem[], // For checking metadata like isPrimary
    processedMediaEntries: VideoEntry[], // Media entries already created (e.g., by Cloudflare upload)
    details: AssetDetails, 
    assetType: AssetType, 
    reviewerName: string, 
    currentUser: any, 
    assetLink: string, 
    downloadUrl: string, 
    setCurrentStepMsg: (message: string) => void
  ): Promise<{ assetId: string | null }> => {
    logger.log(`[VideoLoadSpeedIssue] Starting asset creation (type: ${assetType}) with processed media entries.`);
    setCurrentStepMsg(`Creating ${assetType} asset entry...`);

    let assetId = '';
    let primaryMediaId: string | null = null;

    try {
      // Determine primaryMediaId from the processedMediaEntries, using originalVideoItems for isPrimary flag
      for (const entry of processedMediaEntries) {
        const originalItem = originalVideoItems.find(
          item => (item.file && item.file.name === entry.title) || item.metadata?.title === entry.title
        );
        if (originalItem?.metadata?.isPrimary) {
          primaryMediaId = entry.id; // entry.id is the media_id from 'media' table
          break;
        }
      }
      // Fallback if no match found but there's only one video, make it primary.
      if (!primaryMediaId && processedMediaEntries.length === 1) {
          primaryMediaId = processedMediaEntries[0].id;
      }


      const assetPayload: any = {
        name: details.name,
        description: details.description,
        creator: details.creator === 'someone_else' ? details.creatorName : reviewerName,
        user_id: details.creator === 'self' ? (currentUser?.id || null) : null,
        curator_id: details.creator === 'someone_else' ? (currentUser?.id || null) : null,
        type: assetType,
        download_link: downloadUrl || null,
        admin_status: 'Listed',
        user_status: 'Listed',
        primary_media_id: primaryMediaId, // Set primary_media_id directly here
        lora_base_model: details.model || null, 
        model_variant: details.modelVariant || null,
      };

      if (assetType === 'lora') {
        assetPayload.lora_type = details.loraType;
        assetPayload.lora_link = assetLink || null;
      }

      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert(assetPayload)
        .select()
        .single();

      if (assetError) {
        logger.error(`[VideoLoadSpeedIssue] Error creating asset (type: ${assetType}):`, assetError);
        throw new Error(`Failed to create asset: ${assetError.message}`);
      }

      assetId = assetData.id;
      logger.log(`[VideoLoadSpeedIssue] Asset (type: ${assetType}) created successfully with ID: ${assetId}`);
      setCurrentStepMsg(`${assetType.charAt(0).toUpperCase() + assetType.slice(1)} asset created. Linking media...`);

      // Link processedMediaEntries to the asset
      for (const entry of processedMediaEntries) {
        const videoName = entry.title || `Media ${entry.id}`;
        setCurrentStepMsg(`Linking ${videoName}...`);
        
        const { error: linkError } = await supabase
            .from('asset_media')
            .insert({ 
              asset_id: assetId, 
              media_id: entry.id, // entry.id is the media_id from 'media' table
              status: 'Listed' // Default status
            });

        if (linkError) {
          logger.error(`[VideoLoadSpeedIssue] Error linking asset ${assetId} and media ${entry.id}:`, linkError);
          // Continue trying to link other media
        }
      }
      
      // If primaryMediaId was determined and asset was created, and it wasn't set during asset insert (e.g. if logic changes), update it.
      // This is redundant if primary_media_id is correctly set in the initial assetPayload.
      // if (primaryMediaId && assetId && !assetData.primary_media_id) {
      //   setCurrentStepMsg('Updating primary media for asset...');
      //   const { error: updateError } = await supabase.from('assets').update({ primary_media_id: primaryMediaId }).eq('id', assetId);
      //   if (updateError) logger.error(`[VideoLoadSpeedIssue] Error updating primary media ${primaryMediaId} for asset ${assetId}:`, updateError);
      // }


      setCurrentStepMsg('Finalizing submission details...');
      return { assetId };

    } catch (error: any) { // Catch any error as 'any'
      logger.error(`[VideoLoadSpeedIssue] Exception during asset (type: ${assetType}) creation or media linking:`, error);
      setCurrentStepMsg('An error occurred while saving data.');
      // If asset creation failed, assetId might be empty. If it failed during linking, assetId might exist.
      // Consider cleanup or more specific error handling if needed.
      return { assetId: assetId || null }; // Return assetId if it was created, even if subsequent linking failed partially
    }
  };
  
  return (
    <div className={`flex flex-col ${hideLayout ? '' : 'min-h-screen bg-background'}`}>
      {!hideLayout && <Navigation />}
      
      <main className={`flex-1 ${hideLayout ? 'p-0' : 'container mx-auto p-4'}`}>
        {!hideLayout && (
          <>
            <h1 className="text-3xl font-bold tracking-tight mb-4">Add Asset or Media</h1>
            <p className="text-muted-foreground mb-8">
              Submit a LoRA, Workflow, or media generated with existing assets.
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
              <RadioGroup 
                value={uploadMode} 
                onValueChange={(v) => setUploadMode(v as 'lora' | 'media' | 'workflow')} 
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lora" id="mode-lora" />
                  <Label htmlFor="mode-lora" className="cursor-pointer">LoRA</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="workflow" id="mode-workflow" />
                  <Label htmlFor="mode-workflow" className="cursor-pointer">Workflow</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="media" id="mode-media" />
                  <Label htmlFor="mode-media" className="cursor-pointer">Media Only</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          {/* Conditional Rendering for Forms */}
          {uploadMode === 'lora' && !finalForcedLoraId && (
            <div className="p-6 border rounded-lg bg-card space-y-4">
              <h2 className="text-xl font-semibold">LoRA Details</h2>
              <AssetDetailsForm 
                details={assetDetails}
                updateDetails={updateAssetDetails}
                assetType="lora"
                onFileSelect={setLoraFile}
                disabled={!user || isSubmitting}
              />
            </div>
          )}
          
          {uploadMode === 'workflow' && !finalForcedLoraId && (
          <div className="p-6 border rounded-lg bg-card space-y-4">
              <h2 className="text-xl font-semibold">Workflow Details</h2>
              <AssetDetailsForm 
                details={assetDetails} 
                updateDetails={updateAssetDetails}
                assetType="workflow"
                onFileSelect={setWorkflowFile}
                disabled={!user || isSubmitting}
              />
            </div>
          )}
          
          {/* Video Uploader - common for LoRA and Workflow, conditionally for Media */}
          {(uploadMode === 'lora' || uploadMode === 'workflow' || uploadMode === 'media') && (
            <div className="p-6 border rounded-lg bg-card space-y-4">
              <h2 className="text-xl font-semibold">
                {uploadMode === 'media' ? 'Videos' : 'Example Videos'}
              </h2>
            <MultipleVideoUploader 
              videos={videos} 
              setVideos={setVideos} 
              disabled={!user}
                hideIsPrimary={uploadMode === 'media'} // Only hide for "media only" mode
              defaultClassification={finalDefaultClassification}
            />
          </div>
          )}
          
          <div className="flex items-center space-x-4">
            <Button type="submit" disabled={isSubmitting || !user} size={isMobile ? "sm" : "default"}>
              {isSubmitting ? 'Submitting...' : 
                (uploadMode === 'lora' ? 'Submit LoRA' : 
                (uploadMode === 'workflow' ? 'Submit Workflow' : 'Submit Media'))
              }
            </Button>
            {isSubmitting && currentStepMessage && (
              <p className="text-sm text-muted-foreground animate-pulse">{currentStepMessage}</p>
            )}
            {!isSubmitting && (uploadMode === 'lora' || uploadMode === 'workflow') && (
              <p className="text-sm text-muted-foreground">You can edit all the details after upload.</p>
            )}
          </div>
        </form>
      </main>
      
      {!hideLayout && <Footer />}
    </div>
  );
};

// Helper function to sanitize repo name (remains the same)
function sanitizeRepoName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') 
    .replace(/[^a-z0-9-._]/g, '') 
    .replace(/--+/g, '-') 
    .replace(/^-+|-+$/g, ''); 
}

// Helper function to generate README.md content for LoRAs
// This function should be updated to accept AssetDetails and check type if used for other things
const generateReadmeContent = (
  details: AssetDetails, // Changed from loraDetails
  videoWidgets: { text: string, output: { url: string } }[],
  openMuseUrl?: string
): string => {
  // Ensure this is only called for LoRAs for now or adapt content based on type
  const modelTitle = `${details.model || 'N/A'} (${details.modelVariant || ''})`;
  
  let widgetSection = '';
  if (videoWidgets && videoWidgets.length > 0) {
    widgetSection = videoWidgets.map(v => {
      const promptText = v.text.trim().replace(/\\n/g, '\\n      ');
      return (
`  - text: |
      ${promptText}
    output:
      url: ${v.output.url}`
      );
    }).join('\\n');
  }

  const readmeFrontMatter = `
base_model:
- Lightricks/LTX-Video
${widgetSection ? `widget:\\n${widgetSection}\\n` : ''}tags:
- ltxv
- 13B
- text-to-video
- lora
`.trimStart();

  const userDescription = details.description || 'No description provided.';
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

// Helper to sanitize URLs: trims whitespace and removes non-URL-safe characters
function sanitizeUrl(url: string | null): string | null {
  if (!url) return null;
  let trimmed = url.trim();
  // Remove any characters that are not URL-safe (basic)
  trimmed = trimmed.replace(/[^a-zA-Z0-9-._~:/?#\[\]@!$&'()*+,;=%]/g, '');
  return trimmed.length > 0 ? trimmed : null;
}

export default UploadPage;
