import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { VideoMetadataForm, LoRADetailsForm, MultipleVideoUploader } from './components';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';

const logger = new Logger('Upload');

const UploadPage: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nameInput, setNameInput] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [loraDetails, setLoraDetails] = useState({
    loraName: '',
    loraDescription: '',
    creator: 'self' as 'self' | 'someone_else',
    creatorName: '',
    model: 'wan' as 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff'
  });
  
  const updateLoRADetails = (field: keyof typeof loraDetails, value: string) => {
    setLoraDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const [videos, setVideos] = useState<any[]>([]);
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    const hasVideos = videos.some(video => video.file !== null || video.url !== null);
    if (!hasVideos) {
      toast.error('Please add at least one video (file or link)');
      return;
    }
    
    const missingTitles = videos.filter(video => (video.file || video.url) && !video.metadata.title);
    if (missingTitles.length > 0) {
      toast.error('Please provide a title for all videos');
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

    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }
    
    const reviewerName = user?.email || nameInput || 'Anonymous';
    
    setIsSubmitting(true);
    
    try {
      logger.log("Starting video submission process");
      await submitVideos(videos, loraDetails, reviewerName, user);
      
      const message = videos.filter(v => v.file || v.url).length > 1 
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
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <main className="flex-1 container mx-auto p-4">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Upload Videos</h1>
        <p className="text-muted-foreground mb-8">
          Submit your videos to be reviewed and added to the curated list.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {!user && (
            <div>
              <Label htmlFor="name">Your Name</Label>
              <Input
                type="text"
                id="name"
                placeholder="Enter your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
              />
            </div>
          )}
          
          <div className="p-6 border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-semibold">LoRA Details</h2>
            <p className="text-sm text-muted-foreground mb-4">
              These details will be applied to all videos in this upload.
            </p>
            <LoRADetailsForm loraDetails={loraDetails} updateLoRADetails={updateLoRADetails} />
          </div>
          
          <h2 className="text-xl font-semibold">Videos</h2>
          
          <MultipleVideoUploader 
            videos={videos} 
            setVideos={setVideos} 
          />
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
            />
            <Label htmlFor="terms">I accept the terms and conditions</Label>
          </div>
          
          <Button type="submit" disabled={isSubmitting} size={isMobile ? "sm" : "default"}>
            {isSubmitting ? 'Submitting...' : 'Submit Videos'}
          </Button>
        </form>
      </main>
    </div>
  );
};

async function submitVideos(videos: any[], loraDetails: any, reviewerName: string, user: any) {
  let assetId: string | null = null;
  let primaryMediaId: string | null = null;
  
  logger.log("Creating LoRA asset in Supabase database");
  
  const assetType = 'LoRA';
  
  logger.log(`Creating asset with type=${assetType}, name=${loraDetails.loraName}, description=${loraDetails.loraDescription}, creator=${loraDetails.creator === 'self' ? reviewerName : loraDetails.creatorName}`);
  
  try {
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .insert({
        type: assetType,
        name: loraDetails.loraName,
        description: loraDetails.loraDescription,
        creator: loraDetails.creator === 'self' ? reviewerName : loraDetails.creatorName,
        user_id: user?.id || null
      })
      .select()
      .single();
    
    if (assetError) {
      logger.log(`Error creating asset: ${JSON.stringify(assetError)}`);
      console.error('Error creating asset:', assetError);
      throw new Error('Failed to create asset: ' + assetError.message);
    }
    
    if (!assetData) {
      logger.log('No asset data returned after insertion');
      console.error('No asset data returned after insertion');
      throw new Error('Failed to create asset: no data returned');
    }
    
    assetId = assetData.id;
    logger.log(`Created asset with ID: ${assetId} and type: ${assetType}`);
    
    const { data: verifyAsset, error: verifyError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();
      
    if (verifyError) {
      logger.log(`Error verifying asset creation: ${verifyError.message}`);
    } else {
      logger.log(`Asset verified with data: ${JSON.stringify(verifyAsset)}`);
    }
    
    const primaryVideoData = videos.find(video => 
      (video.file || video.url) && video.metadata.isPrimary
    );
    
    if (!primaryVideoData) {
      logger.log("No primary video found, using the first video as primary");
    }
    
    const processedVideos = [];
    
    for (const video of videos) {
      if (!video.file && !video.url) continue;
      
      const videoUrl = video.url || 'error';
      
      logger.log(`Creating media entry for video ${video.metadata.title}`);
      try {
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .insert({
            title: video.metadata.title,
            url: videoUrl,
            type: 'video',
            classification: video.metadata.classification || 'art',
            creator: video.metadata.creator === 'self' ? reviewerName : video.metadata.creatorName,
            user_id: user?.id || null
          })
          .select()
          .single();
        
        if (mediaError) {
          logger.log(`Error creating media entry: ${JSON.stringify(mediaError)}`);
          console.error('Error creating media entry:', mediaError);
          continue;
        }
        
        if (!mediaData) {
          logger.log('No media data returned after insertion');
          console.error('No media data returned after insertion');
          continue;
        }
        
        const mediaId = mediaData.id;
        logger.log(`Created media with ID: ${mediaId}`);
        
        const isPrimary = video.metadata.isPrimary || (!primaryMediaId && video === videos[0]);
        
        if (isPrimary) {
          primaryMediaId = mediaId;
          logger.log(`Set primary media ID: ${primaryMediaId}`);
        }
        
        logger.log(`Linking asset ${assetId} with media ${mediaId}`);
        const { error: linkError } = await supabase
          .from('asset_media')
          .insert({
            asset_id: assetId,
            media_id: mediaId
          });
        
        if (linkError) {
          logger.log(`Error linking asset and media: ${JSON.stringify(linkError)}`);
          console.error('Error linking asset and media:', linkError);
        } else {
          logger.log(`Linked asset ${assetId} with media ${mediaId}`);
          processedVideos.push(mediaId);
        }
      } catch (mediaInsertError) {
        logger.log(`Exception during media processing: ${JSON.stringify(mediaInsertError)}`);
        console.error('Exception during media processing:', mediaInsertError);
      }
    }
    
    if (primaryMediaId) {
      logger.log(`Updating asset ${assetId} with primary media ${primaryMediaId}`);
      const { error: updateError } = await supabase
        .from('assets')
        .update({ primary_media_id: primaryMediaId })
        .eq('id', assetId);
      
      if (updateError) {
        logger.log(`Error updating asset with primary media: ${JSON.stringify(updateError)}`);
        console.error('Error updating asset with primary media:', updateError);
      } else {
        logger.log(`Updated asset ${assetId} with primary media ${primaryMediaId}`);
      }
    } else {
      logger.log(`Warning: No primary media ID set for asset ${assetId}`);
      console.error("No primary media ID set for asset", assetId);
    }
    
    logger.log(`Asset creation completed. Summary: assetId=${assetId}, primaryMediaId=${primaryMediaId}, videos=${processedVideos.length}`);
    
    const { data: checkAsset, error: checkError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();
      
    if (checkError) {
      logger.log(`Error verifying final asset state: ${checkError.message}`);
    } else {
      logger.log(`Verified final asset state: ${JSON.stringify(checkAsset)}`);
    }
  } catch (assetCreationError) {
    logger.log(`Exception during asset creation process: ${JSON.stringify(assetCreationError)}`);
    console.error('Exception during asset creation process:', assetCreationError);
    throw assetCreationError;
  }
  
  logger.log("Video submission completed successfully");
}

export default UploadPage;
