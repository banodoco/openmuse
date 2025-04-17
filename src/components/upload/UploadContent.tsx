import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LoRADetailsForm, MultipleVideoUploader } from '@/pages/upload/components'; // Adjust path if needed
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { supabaseStorage } from '@/lib/supabaseStorage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

// Import LoraOption type locally here
type LoraOption = {
  id: string;
  name: string;
};

const logger = new Logger('UploadContent');

// --- Types (Copied from UploadPage) ---
type LoRADetails = {
  loraName: string;
  loraDescription: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  modelVariant: string;
  loraType: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Control' | 'Other';
  loraLink: string;
};

type VideoItem = {
  id: string;
  file: File | null;
  url: string | null;
  metadata: {
    title: string;
    description: string;
    classification: 'art' | 'gen';
    creator: 'self' | 'someone_else';
    creatorName: string;
    isPrimary?: boolean;
  };
  associatedLoraIds?: string[];
};

// --- Props Interface ---
interface UploadContentProps {
  initialUploadType?: 'lora' | 'video';
  onSuccess?: () => void;
  onCancel?: () => void; // Optional cancel handler
}

// --- Component Implementation ---
const UploadContent: React.FC<UploadContentProps> = ({
  initialUploadType = 'lora',
  onSuccess,
  onCancel
}) => {
  const navigate = useNavigate(); // Keep navigate for auth redirect for now
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadType, setUploadType] = useState<'lora' | 'video'>(initialUploadType);
  
  // Restore state for availableLoras (but not selected IDs)
  const [availableLoras, setAvailableLoras] = useState<LoraOption[]>([]);
  const [isLoadingLoras, setIsLoadingLoras] = useState(false);

  const [loraDetails, setLoraDetails] = useState<LoRADetails>({
    loraName: '',
    loraDescription: '',
    creator: 'self',
    creatorName: '',
    model: 'wan',
    modelVariant: '1.3b',
    loraType: 'Concept',
    loraLink: ''
  });
  
  const updateLoRADetails = (field: keyof LoRADetails, value: string) => {
    setLoraDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const [videos, setVideos] = useState<VideoItem[]>([]);
  
  // Restore useEffect hook for fetching LoRAs
  useEffect(() => {
    const fetchLoras = async () => {
      // Fetch LoRAs regardless of tab, but only if logged in
      if (user) { 
        setIsLoadingLoras(true);
        setAvailableLoras([]); // Clear previous options
        logger.log('Fetching available LoRAs...');
        try {
          const { data, error } = await supabase
            .from('assets')
            .select('id, name')
            .eq('type', 'LoRA') // Only fetch LoRA type assets
            .order('name', { ascending: true });
          
          if (error) throw error;
          
          if (data) {
            setAvailableLoras(data);
            logger.log(`Fetched ${data.length} LoRAs`);
          } else {
            setAvailableLoras([]);
          }
        } catch (error: any) {
          logger.error('Error fetching LoRAs:', error);
          toast.error('Failed to load available LoRAs.');
          setAvailableLoras([]);
        } finally {
          setIsLoadingLoras(false);
        }
      } else {
        // Clear LoRA state if not logged in
        setAvailableLoras([]);
      }
    };
    
    fetchLoras();
  }, [user]); // Re-run only if user changes
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!user) {
      toast.error('You must be signed in to submit');
      // Consider if redirect is appropriate here or should be handled by parent
      navigate('/auth'); 
      return;
    }
    
    const hasVideos = videos.some(video => video.file !== null || video.url !== null);
    if (!hasVideos) {
      toast.error('Please add at least one video (file or link)');
      return;
    }
    
    // LoRA specific validation
    if (uploadType === 'lora') {
        if (!loraDetails.loraName) {
          toast.error('Please provide a LoRA name');
          return;
        }
        if (loraDetails.creator === 'someone_else' && !loraDetails.creatorName) {
          toast.error('Please provide the creator name for the LoRA');
          return;
        }
        const missingCreatorNames = videos.filter(
          video => video.file && video.metadata.creator === 'someone_else' && !video.metadata.creatorName
        );
        if (missingCreatorNames.length > 0) {
          toast.error('Please provide the creator name for all videos created by someone else');
          return;
        }
        const hasPrimary = videos.some(video => (video.file || video.url) && video.metadata.isPrimary);
        if (!hasPrimary) {
          toast.error('Please set one video as the primary media for this LoRA');
          return;
        }
    }

    const reviewerName = user?.email || 'Anonymous';
    setIsSubmitting(true);
    
    try {
      logger.log(`Starting ${uploadType} submission process`);
      
      const uploadedVideoData: { id: string; url: string; metadata: VideoItem['metadata']; model?: string; modelVariant?: string }[] = [];
      for (const video of videos) {
        let videoId = video.id || uuidv4();
        let videoUrl = video.url;
        let model = uploadType === 'lora' ? loraDetails.model : undefined;
        let modelVariant = uploadType === 'lora' ? loraDetails.modelVariant : undefined;
        
        if (video.file) {
          const uploadResult = await supabaseStorage.uploadVideo({
            id: videoId, blob: video.file, metadata: { ...video.metadata, model, modelVariant }
          });
          videoUrl = uploadResult.url;
        }

        if (videoUrl) {
            uploadedVideoData.push({ id: videoId, url: videoUrl, metadata: video.metadata, model, modelVariant });
        } else {
            logger.warn(`Skipping video due to missing URL: ${video.metadata.title || video.id}`);
        }
      }

      if (uploadType === 'lora') {
        await submitLoraAndVideos(uploadedVideoData, loraDetails, reviewerName, user);
      } else {
        // Pass uploaded video data which now contains associatedLoraIds per video
        await submitStandaloneVideos(uploadedVideoData, reviewerName, user);
      }

      const message = uploadedVideoData.length > 1
        ? `${uploadType === 'lora' ? 'LoRA and videos' : 'Videos'} submitted successfully! Awaiting admin approval.`
        : `${uploadType === 'lora' ? 'LoRA and video' : 'Video'} submitted successfully! Awaiting admin approval.`;

      toast.success(message);
      onSuccess?.(); // Call the success callback instead of navigating
      
      // Reset state after successful submission
      setVideos([]);
      setLoraDetails({ 
        loraName: '', loraDescription: '', creator: 'self', creatorName: '',
        model: 'wan', modelVariant: '1.3b', loraType: 'Concept', loraLink: '' 
      });
      setUploadType(initialUploadType); // Reset to initial type

    } catch (error: any) {
      logger.error('Error during submission:', error);
      toast.error(error.message || `Failed to submit ${uploadType}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const submitLoraAndVideos = async (uploadedVideos: any[], loraDetails: LoRADetails, reviewerName: string, user: any) => {
    let assetId: string | null = null;
    let primaryMediaId: string | null = null;

    logger.log("Creating LoRA asset");
    const assetType = 'LoRA';

    try {
      // Create Asset
      const { data: assetData, error: assetError } = await supabase.from('assets').insert({
        type: assetType, name: loraDetails.loraName, description: loraDetails.loraDescription,
        creator: loraDetails.creator === 'self' ? reviewerName : loraDetails.creatorName,
        user_id: user?.id || null, lora_type: loraDetails.loraType, lora_base_model: loraDetails.model,
        lora_link: loraDetails.loraLink, model_variant: loraDetails.modelVariant
      }).select().single();

      if (assetError) throw new Error('Asset creation failed: ' + assetError.message);
      if (!assetData) throw new Error('Asset creation failed: No data returned');
      assetId = assetData.id;
      logger.log(`Created asset ID: ${assetId}`);

      // Create Media entries and link
      for (const video of uploadedVideos) {
        logger.log(`Processing media: ${video.metadata.title}`);
        try {
          const { data: mediaData, error: mediaError } = await supabase.from('media').insert({
            id: video.id, title: video.metadata.title, url: video.url, type: video.model,
            model_variant: video.modelVariant, classification: video.metadata.classification || 'art',
            creator: video.metadata.creator === 'self' ? reviewerName : video.metadata.creatorName,
            user_id: user?.id || null
          }).select().single();

          if (mediaError) throw new Error(`Media creation failed: ${mediaError.message}`);
          if (!mediaData) throw new Error('Media creation failed: No data returned');
          const mediaId = mediaData.id;
          logger.log(`Created media ID: ${mediaId}`);

          logger.log(`Linking asset ${assetId} with media ${mediaId}`);
          const { error: linkError } = await supabase.from('asset_media').insert({ asset_id: assetId, media_id: mediaId });
          if (linkError) throw new Error(`Asset-Media link failed: ${linkError.message}`);
          
          if (video.metadata.isPrimary) primaryMediaId = mediaId;

        } catch (mediaError: any) {
          logger.error(`Error processing video ${video.metadata.title}:`, mediaError);
          // Continue processing other videos
        }
      }
      
      // Update asset with primary media ID
      if (primaryMediaId && assetId) {
          logger.log(`Updating asset ${assetId} with primary_media_id ${primaryMediaId}`);
          const { error: updateError } = await supabase.from('assets')
              .update({ primary_media_id: primaryMediaId }).eq('id', assetId);
          if (updateError) logger.error(`Failed to update asset primary media ID: ${updateError.message}`);
      } else if (!primaryMediaId) {
          logger.warn(`No primary media set for asset ${assetId}.`);
      }

    } catch (error: any) {
      logger.error('Error in submitLoraAndVideos:', error);
      throw error; // Re-throw to be caught by handleSubmit
    }
  };

  const submitStandaloneVideos = async (
    uploadedVideos: any[], 
    reviewerName: string, 
    user: any, 
  ) => {
    logger.log("Submitting standalone videos");
    for (const video of uploadedVideos) {
      logger.log(`Processing standalone media: ${video.metadata.title}`);
      let mediaId: string | null = null;
      const associatedLoraIds = video.associatedLoraIds || []; // Get IDs from video item
      try {
        const { data: mediaData, error: mediaError } = await supabase.from('media').insert({
          id: video.id, title: video.metadata.title, url: video.url, type: 'video', // Use 'video' type?
          model_variant: null, classification: video.metadata.classification || 'art',
          // Video creator is always 'self' (logged-in user)
          creator: reviewerName, 
          user_id: user?.id || null
        }).select('id').single(); // Only select id

        if (mediaError) throw new Error(`Standalone media creation failed: ${mediaError.message}`);
        if (!mediaData) throw new Error('Standalone media creation failed: No data returned');
        mediaId = mediaData.id;
        logger.log(`Created standalone media ID: ${mediaId}`);
        
        // Link video to selected LoRAs (using video.associatedLoraIds)
        if (mediaId && associatedLoraIds.length > 0) {
          logger.log(`Linking media ${mediaId} to ${associatedLoraIds.length} LoRAs: ${associatedLoraIds.join(', ')}`);
          const links = associatedLoraIds.map(loraId => ({ asset_id: loraId, media_id: mediaId }));
          const { error: linkError } = await supabase.from('asset_media').insert(links);
          if (linkError) {
            // Log error but don't necessarily fail the whole upload
            logger.error(`Failed to link media ${mediaId} to some LoRAs: ${linkError.message}`);
            toast.warning('Could not link video to all selected LoRAs.');
          }
        }

      } catch (mediaError: any) {
        logger.error(`Error processing standalone video ${video.metadata.title}:`, mediaError);
        // If media creation fails, we definitely want to throw
        throw mediaError; // Re-throw to be caught by handleSubmit
      }
    }
    logger.log("Standalone video submission finished.");
  };
  
  return (
    <div className="w-full"> 
      <Tabs value={uploadType} onValueChange={(value) => setUploadType(value as 'lora' | 'video')} className="w-full mb-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="lora">LoRA</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
        </TabsList>
        
        <TabsContent value="lora">
          <form onSubmit={handleSubmit} className="space-y-8">
            <LoRADetailsForm 
              loraDetails={loraDetails} 
              updateLoRADetails={updateLoRADetails} 
              disabled={!user || isSubmitting}
            />
            <MultipleVideoUploader 
              videos={videos} 
              setVideos={setVideos} 
              disabled={!user || isSubmitting}
              allowPrimarySelection={true}
              availableLoras={availableLoras}
            />
            <div className="flex justify-end gap-2">
              {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>}
              <Button type="submit" disabled={isSubmitting || !user}>
                {isSubmitting ? 'Submitting...' : 'Submit LoRA & Videos'}
              </Button>
            </div>
          </form>
        </TabsContent>
        
        <TabsContent value="video">
          <form onSubmit={handleSubmit} className="space-y-8">
            <MultipleVideoUploader 
              videos={videos} 
              setVideos={setVideos} 
              disabled={!user || isSubmitting}
              allowPrimarySelection={false}
              availableLoras={availableLoras}
            />
            
            <div className="flex justify-end gap-2">
              {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>}
              <Button type="submit" disabled={isSubmitting || !user}>
                {isSubmitting ? 'Submitting...' : 'Submit Videos'}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UploadContent; 