import React, { useState } from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { VideoMetadataForm, LoRADetailsForm, MultipleVideoUploader } from './components';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { supabaseStorage } from '@/lib/supabaseStorage';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { VideoItem } from '@/lib/types';
import { thumbnailService } from '@/lib/services/thumbnailService';

const logger = new Logger('Upload');

// Define the LoRADetails type explicitly
interface LoRADetails {
  loraName: string;
  loraDescription: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  modelVariant: string; // Can be more specific if needed
  loraType: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Control' | 'Other';
  loraLink: string;
}

const UploadPage: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  
  const [videos, setVideos] = useState<any[]>([]);
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!user) {
      toast.error('You must be signed in to submit videos');
      navigate('/auth');
      return;
    }
    
    const hasVideos = videos.some(video => video.file !== null || video.url !== null);
    if (!hasVideos) {
      toast.error('Please add at least one video (file or link)');
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
    
    const reviewerName = user?.email || 'Anonymous';
    
    setIsSubmitting(true);
    
    try {
      // logger.log("Starting video submission process");
      
      // Process files first to upload them to storage
      for (const video of videos) {
        if (video.file) {
          // Generate UUID for the video
          const videoId = uuidv4();
          
          // Upload to Supabase Storage
          const uploadResult = await supabaseStorage.uploadVideo({
            id: videoId,
            blob: video.file,
            metadata: {
              ...video.metadata,
              model: loraDetails.model, // Ensure model is set from loraDetails
              modelVariant: loraDetails.modelVariant // Add model variant
            }
          });
          
          // Replace the local blob URL with the permanent Supabase URL
          video.url = uploadResult.url;
          video.id = videoId;
          video.file = null; // Clear the file reference as we've uploaded it
        }
      }
      
      await submitVideos(videos, loraDetails, reviewerName, user);
      
      const message = videos.filter(v => v.url).length > 1 
        ? 'Videos submitted successfully! Awaiting admin approval.'
        : 'Video submitted successfully! Awaiting admin approval.';
      
      toast.success(message);
      navigate('/');
    } catch (error: any) {
      console.error('Error submitting videos:', error);
      toast.error(error.message || 'Failed to submit videos');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const submitVideos = async (videos: VideoItem[], loraDetails: LoRADetails, reviewerName: string, user: any) => {
    logger.log("Starting asset creation and video submission process");

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
          creator: loraDetails.creator === 'self' ? reviewerName : loraDetails.creatorName,
          user_id: user?.id || null,
          type: 'lora',
          lora_type: loraDetails.loraType,
          lora_base_model: loraDetails.model,
          model_variant: loraDetails.modelVariant,
          lora_link: loraDetails.loraLink || null
        })
        .select()
        .single();

      if (assetError) {
        logger.error('Error creating asset:', assetError);
        throw new Error(`Failed to create asset: ${assetError.message}`);
      }

      assetId = assetData.id;
      logger.log(`Asset created successfully with ID: ${assetId}`);

      // Step 2: Process and link each video
      const processedVideos = [];
      for (const video of videos) {
        if (!video.url) continue; // Skip if URL is missing (e.g., upload failed earlier)

        const videoUrl = video.url;

        try {
          // Generate thumbnail for the video
          logger.log(`Generating thumbnail for video: ${video.metadata.title || 'Untitled'}`);
          const thumbnailUrl = await thumbnailService.generateThumbnail(videoUrl);
          logger.log(`Thumbnail generated for ${video.metadata.title || 'Untitled'}: ${thumbnailUrl ? 'Success' : 'Failed'}`);

          logger.log(`Creating media entry for video ${video.metadata.title || 'Untitled'}`);
          const { data: mediaData, error: mediaError } = await supabase
            .from('media')
            .insert({
              title: video.metadata.title || '',
              url: videoUrl,
              type: 'video',
              model_variant: loraDetails.modelVariant,
              classification: video.metadata.classification || 'art',
              creator: video.metadata.creator === 'self' ? reviewerName : video.metadata.creatorName,
              user_id: user?.id || null,
              placeholder_image: thumbnailUrl // Save the generated thumbnail URL
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

          // Determine if this video is primary
          const isPrimary = video.metadata.isPrimary || (!primaryMediaId && video === videos[0]);
          if (isPrimary && !primaryMediaId) {
            primaryMediaId = mediaId;
            logger.log(`Set primary media ID: ${primaryMediaId}`);
          }

          // Link asset and media
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
        }
      } else {
        logger.warn(`Warning: No primary media ID set or determined for asset ${assetId}`);
      }

      logger.log(`Asset creation and video submission completed. Summary: assetId=${assetId}, primaryMediaId=${primaryMediaId}, videos=${processedVideos.length}`);

    } catch (error) {
      logger.error('Exception during asset creation or video submission process:', error);
      throw error; // Re-throw to be caught by the outer handleSubmit try-catch
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <main className="flex-1 container mx-auto p-4">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Add LoRA</h1>
        <p className="text-muted-foreground mb-8">
          Submit a LoRA that you or someone else made to be featured.
        </p>
        
        {!user && (
          <Alert className="mb-8 border border-olive/20 bg-cream-light text-foreground font-body">
            <AlertTitle className="font-heading font-medium">You must be signed in to submit videos.</AlertTitle>
            <AlertDescription className="mt-1 font-body">
              Please <Link to="/auth" className="font-medium text-olive hover:text-olive-dark underline">sign in</Link> to access all features. You can preview the form below, but fields are disabled.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="p-6 border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-semibold">LoRA Details</h2>
            <LoRADetailsForm 
              loraDetails={loraDetails} 
              updateLoRADetails={updateLoRADetails}
              disabled={!user} 
            />
          </div>
          
          <div className="p-6 border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-semibold">Videos made with it</h2>
            <MultipleVideoUploader 
              videos={videos} 
              setVideos={setVideos} 
              disabled={!user}
            />
          </div>
          
          <Button type="submit" disabled={isSubmitting || !user} size={isMobile ? "sm" : "default"}>
            {isSubmitting ? 'Submitting...' : 'Submit LoRA'}
          </Button>
        </form>
      </main>
      
      <Footer />
    </div>
  );
};

export default UploadPage;
