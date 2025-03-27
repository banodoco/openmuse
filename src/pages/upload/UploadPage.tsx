
import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { videoDB } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { VideoMetadataForm, LoRADetailsForm, MultipleVideoUploader } from './components';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';

const logger = new Logger('Upload');

interface LoRADetailsForm {
  loraName: string;
  loraDescription: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
}

const UploadPage: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nameInput, setNameInput] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [loraDetails, setLoraDetails] = useState<LoRADetailsForm>({
    loraName: '',
    loraDescription: '',
    creator: 'self',
    creatorName: '',
    model: 'wan'
  });
  
  const updateLoRADetails = (field: keyof LoRADetailsForm, value: string) => {
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
    
    setIsSubmitting(true);
    
    try {
      logger.log("Starting video submission process");
      await submitVideos(videos, loraDetails, user?.email || nameInput, user);
      
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
          <div>
            <Label htmlFor="name">Your Name</Label>
            <Input
              type="text"
              id="name"
              placeholder="Enter your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={!!user}
            />
          </div>
          
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
  const db = videoDB;
  
  let assetId: string | null = null;
  let primaryMediaId: string | null = null;
  
  if (user && user.id) {
    logger.log("Creating LoRA asset in Supabase database");
    
    // Ensure we use the correct and consistent type for LoRA
    const assetType = 'LoRA'; // Use capitalized "LoRA" consistently
    
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .insert({
        type: assetType, // Using the consistent type
        name: loraDetails.loraName,
        description: loraDetails.loraDescription,
        creator: loraDetails.creator === 'self' ? reviewerName : loraDetails.creatorName,
        user_id: user.id
      })
      .select()
      .single();
    
    if (assetError) {
      console.error('Error creating asset:', assetError);
      throw new Error('Failed to create asset');
    }
    
    assetId = assetData.id;
    console.log(`Created asset with ID: ${assetId} and type: ${assetType}`);
    
    // Find the primary video
    const primaryVideoData = videos.find(video => 
      (video.file || video.url) && video.metadata.isPrimary
    );
    
    if (!primaryVideoData) {
      console.warn("No primary video found, using the first video as primary");
    }
    
    // Process all videos
    for (const video of videos) {
      if (!video.file && !video.url) continue;
      
      const videoUrl = video.url || 'error';
      
      logger.log(`Creating media entry for video ${video.metadata.title}`);
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .insert({
          title: video.metadata.title,
          url: videoUrl,
          type: 'video',
          classification: video.metadata.classification,
          creator: video.metadata.creator === 'self' ? reviewerName : video.metadata.creatorName,
          user_id: user.id
        })
        .select()
        .single();
      
      if (mediaError) {
        console.error('Error creating media entry:', mediaError);
        continue;
      }
      
      const mediaId = mediaData.id;
      console.log(`Created media with ID: ${mediaId}`);
      
      if (video.metadata.isPrimary || (!primaryMediaId && video === videos[0])) {
        primaryMediaId = mediaId;
        console.log(`Set primary media ID: ${primaryMediaId}`);
      }
      
      logger.log(`Linking asset ${assetId} with media ${mediaId}`);
      const { error: linkError } = await supabase
        .from('asset_media')
        .insert({
          asset_id: assetId,
          media_id: mediaId
        });
      
      if (linkError) {
        console.error('Error linking asset and media:', linkError);
      } else {
        console.log(`Linked asset ${assetId} with media ${mediaId}`);
      }
    }
    
    // Make sure we have a primary media set
    if (primaryMediaId) {
      logger.log(`Updating asset ${assetId} with primary media ${primaryMediaId}`);
      const { error: updateError } = await supabase
        .from('assets')
        .update({ primary_media_id: primaryMediaId })
        .eq('id', assetId);
      
      if (updateError) {
        console.error('Error updating asset with primary media:', updateError);
      } else {
        console.log(`Updated asset ${assetId} with primary media ${primaryMediaId}`);
      }
    } else {
      console.error("No primary media ID set for asset", assetId);
    }
  }
  
  logger.log("Creating entries in video_entries table for backward compatibility");
  
  for (const video of videos) {
    if (!video.file && !video.url) continue;
    
    const videoMetadata = {
      title: video.metadata.title,
      description: video.metadata.description,
      classification: video.metadata.classification,
      creator: video.metadata.creator,
      creatorName: video.metadata.creator === 'someone_else' ? video.metadata.creatorName : undefined,
      model: loraDetails.model,
      loraName: loraDetails.loraName,
      loraDescription: loraDetails.loraDescription,
      assetId: assetId,
      isPrimary: video.metadata.isPrimary
    };
    
    const newEntry = {
      video_location: video.url || 'error',
      reviewer_name: reviewerName,
      skipped: false,
      user_id: user?.id || null,
      metadata: videoMetadata
    };
    
    await db.addEntry(newEntry);
  }
  
  logger.log("Video submission completed successfully");
}

export default UploadPage;
