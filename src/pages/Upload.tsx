
import React, { useState, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/hooks/useAuth';
import { videoDB } from '@/lib/db';
import { VideoEntry, VideoMetadata } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { Checkbox } from '@/components/ui/checkbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logger } from '@/lib/logger';
import VideoPreview from '@/components/VideoPreview';
import { PlusCircle, X, Upload as UploadIcon } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import VideoDropzoneComponent from '@/components/upload/VideoDropzone';
import VideoMetadataForm from '@/components/upload/VideoMetadataForm';
import LoRADetailsForm from '@/components/upload/LoRADetailsForm';

const logger = new Logger('Upload');

// Interface for video metadata
interface VideoMetadataForm {
  title: string;
  description: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  classification: 'art' | 'gen';
  model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  // LoRA details
  loraName: string;
  loraDescription: string;
  baseModel: string;
  trainingSteps: string;
  resolution: string;
  trainingDataset: string;
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
    creator: 'self',
    creatorName: '',
    classification: 'gen',
    model: 'wan',
    // LoRA details
    loraName: '',
    loraDescription: '',
    baseModel: '',
    trainingSteps: '',
    resolution: '',
    trainingDataset: ''
  };
  
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
        // Update the state with both file and url in one update
        setVideos(prev => 
          prev.map(video => 
            video.id === id 
              ? { ...video, file: file, url: url } 
              : video
          )
        );
      }
    };
  };
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    const hasVideos = videos.some(video => video.file !== null);
    if (!hasVideos) {
      toast.error('Please upload at least one video');
      return;
    }
    
    // Validate if each uploaded video has title
    const missingTitles = videos.filter(video => video.file && !video.metadata.title);
    if (missingTitles.length > 0) {
      toast.error('Please provide a title for all uploaded videos');
      return;
    }

    // Validate if creator name is provided for "someone_else"
    const missingCreatorName = videos.filter(
      video => video.file && 
      video.metadata.creator === 'someone_else' && 
      !video.metadata.creatorName
    );
    if (missingCreatorName.length > 0) {
      toast.error('Please provide the creator name for videos not created by you');
      return;
    }
    
    // Validate LoRA details
    const missingLoRADetails = videos.filter(
      video => video.file && !video.metadata.loraName
    );
    if (missingLoRADetails.length > 0) {
      toast.error('Please provide LoRA details for all uploaded videos');
      return;
    }
    
    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const db = await databaseSwitcher.getDatabase();
      const reviewerName = user?.email || nameInput;
      
      // Submit each video with its own metadata
      for (const video of videos) {
        if (!video.file) continue;
        
        const videoMetadata: VideoMetadata = {
          title: video.metadata.title,
          description: video.metadata.description,
          creator: video.metadata.creator,
          creatorName: video.metadata.creator === 'someone_else' ? video.metadata.creatorName : undefined,
          classification: video.metadata.classification,
          model: video.metadata.model,
          // Include LoRA details in the metadata
          loraName: video.metadata.loraName,
          loraDescription: video.metadata.loraDescription,
          baseModel: video.metadata.baseModel,
          trainingSteps: video.metadata.trainingSteps,
          resolution: video.metadata.resolution,
          trainingDataset: video.metadata.trainingDataset
        };
        
        const newEntry: Omit<VideoEntry, "id" | "created_at" | "admin_approved"> = {
          video_location: video.url || 'error',
          reviewer_name: reviewerName,
          skipped: false,
          user_id: user?.id || null,
          metadata: videoMetadata
        };
        
        await db.createEntry(newEntry);
      }
      
      const message = videos.filter(v => v.file).length > 1 
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
          
          {/* Videos Section */}
          <h2 className="text-xl font-semibold">Videos</h2>
          
          {videos.map((video, index) => (
            <div key={video.id} className="p-6 border rounded-lg bg-card space-y-4 mb-8">
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
              
              {!video.file ? (
                <div className="w-full flex justify-center">
                  <VideoDropzoneComponent 
                    id={video.id} 
                    file={video.file} 
                    url={video.url} 
                    onDrop={handleVideoFileDrop(video.id)} 
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <VideoPreview 
                    file={video.file} 
                    className="w-full md:w-2/3 mx-auto"
                  />
                  
                  {/* Video Metadata and LoRA Forms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <VideoMetadataForm
                      videoId={video.id}
                      metadata={video.metadata}
                      updateMetadata={updateVideoMetadata}
                    />
                    
                    <LoRADetailsForm
                      videoId={video.id}
                      metadata={video.metadata}
                      updateMetadata={updateVideoMetadata}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          
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
