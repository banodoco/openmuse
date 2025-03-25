import React, { useState, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { videoDB } from '@/lib/db';
import { VideoEntry, VideoMetadata } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import VideoPreview from '@/components/VideoPreview';
import { PlusCircle, X, Link as LinkIcon } from 'lucide-react';
import VideoDropzoneComponent from '@/components/upload/VideoDropzone';
import VideoMetadataForm from '@/components/upload/VideoMetadataForm';
import GlobalLoRADetailsForm from '@/components/upload/GlobalLoRADetailsForm';
import { supabase } from '@/integrations/supabase/client';

const logger = new Logger('Upload');

// Interface for video metadata
interface VideoMetadataForm {
  title: string;
  description: string;
  classification: 'art' | 'gen';
  creator: 'self' | 'someone_else';
  creatorName: string;
}

// Interface for global LoRA details
interface LoRADetailsForm {
  loraName: string;
  loraDescription: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
}

// Interface for a video item in the upload form
interface VideoItem {
  id: string;
  file: File | null;
  url: string | null;
  metadata: VideoMetadataForm;
}

const Upload: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nameInput, setNameInput] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initial empty video metadata
  const initialMetadata: VideoMetadataForm = {
    title: '',
    description: '',
    classification: 'gen',
    creator: 'self',
    creatorName: '',
  };
  
  // Global LoRA details
  const [loraDetails, setLoraDetails] = useState<LoRADetailsForm>({
    loraName: '',
    loraDescription: '',
    creator: 'self',
    creatorName: '',
    model: 'wan'
  });
  
  // State for multiple videos
  const [videos, setVideos] = useState<VideoItem[]>([{
    id: crypto.randomUUID(),
    file: null,
    url: null,
    metadata: initialMetadata
  }]);
  
  const updateVideoMetadata = (id: string, field: keyof VideoMetadataForm, value: any) => {
    setVideos(prev => 
      prev.map(video => 
        video.id === id ? { 
          ...video, 
          metadata: { 
            ...video.metadata, 
            [field]: value 
          } 
        } : video
      )
    );
  };
  
  const updateLoRADetails = (field: keyof LoRADetailsForm, value: string) => {
    setLoraDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleAddVideo = () => {
    setVideos([...videos, {
      id: crypto.randomUUID(),
      file: null,
      url: null,
      metadata: initialMetadata
    }]);
  };
  
  const handleRemoveVideo = (id: string) => {
    if (videos.length <= 1) {
      toast.error('You must have at least one video');
      return;
    }
    
    setVideos(videos.filter(video => video.id !== id));
  };
  
  const updateVideoField = (id: string, field: keyof VideoItem, value: any) => {
    setVideos(prev => 
      prev.map(video => 
        video.id === id ? { ...video, [field]: value } : video
      )
    );
  };
  
  const handleVideoFileDrop = (id: string) => {
    return (acceptedFiles: File[]) => {
      console.log("File dropped:", acceptedFiles);
      const file = acceptedFiles[0];
      if (file) {
        const url = URL.createObjectURL(file);
        console.log("Created URL:", url);
        
        // Extract filename without extension to use as default title
        const fileName = file.name;
        const fileNameWithoutExtension = fileName.split('.').slice(0, -1).join('.');
        const defaultTitle = fileNameWithoutExtension || fileName;
        
        // Update the state with file, url, and default title
        setVideos(prev => 
          prev.map(video => 
            video.id === id 
              ? { 
                  ...video, 
                  file: file, 
                  url: url,
                  metadata: {
                    ...video.metadata,
                    title: defaultTitle
                  }
                } 
              : video
          )
        );
      }
    };
  };
  
  const handleVideoLinkAdded = (id: string) => {
    return (linkUrl: string) => {
      console.log("Link added:", linkUrl);
      
      // Extract video title from URL
      let defaultTitle = '';
      
      try {
        // For YouTube links, try to extract the video ID or use the URL
        if (linkUrl.includes('youtube.com/') || linkUrl.includes('youtu.be/')) {
          const url = new URL(linkUrl);
          const videoId = url.searchParams.get('v') || 
                          linkUrl.split('/').pop()?.split('?')[0] || 
                          'YouTube Video';
          defaultTitle = `YouTube Video - ${videoId}`;
        } 
        // For Vimeo links
        else if (linkUrl.includes('vimeo.com/')) {
          const videoId = linkUrl.split('/').pop() || 'Vimeo Video';
          defaultTitle = `Vimeo Video - ${videoId}`;
        }
        // For direct video links
        else {
          const fileName = linkUrl.split('/').pop() || 'Video';
          const fileNameWithoutExtension = fileName.split('.').slice(0, -1).join('.');
          defaultTitle = fileNameWithoutExtension || fileName;
        }
      } catch (e) {
        // If URL parsing fails, use a generic title
        defaultTitle = 'External Video';
      }
      
      // Update the state with the video URL
      setVideos(prev => 
        prev.map(video => 
          video.id === id 
            ? { 
                ...video, 
                file: null, 
                url: linkUrl,
                metadata: {
                  ...video.metadata,
                  title: defaultTitle
                }
              } 
            : video
        )
      );
    };
  };
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    const hasVideos = videos.some(video => video.file !== null || video.url !== null);
    if (!hasVideos) {
      toast.error('Please add at least one video (file or link)');
      return;
    }
    
    // Validate if each uploaded video has title
    const missingTitles = videos.filter(video => (video.file || video.url) && !video.metadata.title);
    if (missingTitles.length > 0) {
      toast.error('Please provide a title for all videos');
      return;
    }

    // Validate LoRA details
    if (!loraDetails.loraName) {
      toast.error('Please provide a LoRA name');
      return;
    }
    
    // Validate if creator name is provided for "someone_else"
    if (loraDetails.creator === 'someone_else' && !loraDetails.creatorName) {
      toast.error('Please provide the creator name for the LoRA');
      return;
    }
    
    // Validate if creator name is provided for "someone_else" for each video
    const missingCreatorNames = videos.filter(
      video => video.file && video.metadata.creator === 'someone_else' && !video.metadata.creatorName
    );
    if (missingCreatorNames.length > 0) {
      toast.error('Please provide the creator name for all videos created by someone else');
      return;
    }

    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const db = videoDB;
      const reviewerName = user?.email || nameInput;
      
      // Create the asset first
      let assetId: string | null = null;
      
      // Only proceed with Supabase operations if user is authenticated
      if (user && user.id) {
        // Create the asset in Supabase
        const { data: assetData, error: assetError } = await supabase
          .from('assets')
          .insert({
            type: 'LoRA',
            name: loraDetails.loraName,
            description: loraDetails.loraDescription,
            creator: loraDetails.creator === 'self' ? reviewerName : loraDetails.creatorName,
            user_id: user.id
          })
          .select()
          .single();
        
        if (assetError) {
          console.error('Error creating asset:', assetError);
          toast.error('Failed to create asset');
          setIsSubmitting(false);
          return;
        }
        
        assetId = assetData.id;
        logger.log(`Created asset with ID: ${assetId}`);
        
        // Create media entries for each video and link them to the asset
        for (const video of videos) {
          if (!video.file && !video.url) continue;
          
          const videoUrl = video.url || 'error';
          
          // Create media entry
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
          logger.log(`Created media with ID: ${mediaId}`);
          
          // Create association between asset and media
          const { error: linkError } = await supabase
            .from('asset_media')
            .insert({
              asset_id: assetId,
              media_id: mediaId
            });
          
          if (linkError) {
            console.error('Error linking asset and media:', linkError);
          } else {
            logger.log(`Linked asset ${assetId} with media ${mediaId}`);
          }
        }
      }
      
      // Submit each video with its own metadata but shared LoRA details to the existing system
      for (const video of videos) {
        if (!video.file && !video.url) continue;
        
        const videoMetadata: VideoMetadata = {
          title: video.metadata.title,
          description: video.metadata.description,
          classification: video.metadata.classification,
          creator: video.metadata.creator,
          creatorName: video.metadata.creator === 'someone_else' ? video.metadata.creatorName : undefined,
          model: loraDetails.model,
          loraName: loraDetails.loraName,
          loraDescription: loraDetails.loraDescription,
          assetId: assetId
        };
        
        const newEntry: Omit<VideoEntry, "id" | "created_at" | "admin_approved"> = {
          video_location: video.url || 'error',
          reviewer_name: reviewerName,
          skipped: false,
          user_id: user?.id || null,
          metadata: videoMetadata
        };
        
        await db.addEntry(newEntry);
      }
      
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
          
          {/* Global LoRA Details Section */}
          <div className="p-6 border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-semibold">LoRA Details</h2>
            <p className="text-sm text-muted-foreground mb-4">
              These details will be applied to all videos in this upload.
            </p>
            <GlobalLoRADetailsForm loraDetails={loraDetails} updateLoRADetails={updateLoRADetails} />
          </div>
          
          {/* Videos Section */}
          <h2 className="text-xl font-semibold">Videos</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {videos.map((video, index) => (
              <div key={video.id} className="p-6 border rounded-lg bg-card space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Video {index + 1}</h3>
                  {videos.length > 1 && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveVideo(video.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
                
                {!video.file && !video.url ? (
                  <div className="w-full flex justify-center">
                    <VideoDropzoneComponent 
                      id={video.id} 
                      file={video.file} 
                      url={video.url} 
                      onDrop={handleVideoFileDrop(video.id)}
                      onLinkAdded={handleVideoLinkAdded(video.id)}
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {video.file ? (
                      <VideoPreview 
                        file={video.file} 
                        className="w-full mx-auto"
                      />
                    ) : video.url ? (
                      <div className="w-full aspect-video flex flex-col items-center justify-center bg-muted/50 rounded-md overflow-hidden">
                        <LinkIcon className="h-12 w-12 text-muted-foreground mb-2" />
                        <div className="text-center px-4">
                          <p className="text-sm font-medium mb-1 break-all">{video.url}</p>
                          <p className="text-xs text-muted-foreground">External video link</p>
                        </div>
                      </div>
                    ) : null}
                    
                    <div className="mt-4">
                      <VideoMetadataForm
                        videoId={video.id}
                        metadata={video.metadata}
                        updateMetadata={updateVideoMetadata}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-center">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleAddVideo}
              className="mx-auto"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Another Video
            </Button>
          </div>
          
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

export default Upload;
