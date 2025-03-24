
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

const logger = new Logger('Upload');

// Interface for a video item in the upload form
interface VideoItem {
  id: string;
  file: File | null;
  url: string | null;
}

// Interface for the LoRA metadata
interface LoRAMetadata {
  title: string;
  description: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  classification: 'art' | 'gen';
  model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
}

const Upload: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nameInput, setNameInput] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for LoRA metadata
  const [loraMetadata, setLoraMetadata] = useState<LoRAMetadata>({
    title: '',
    description: '',
    creator: 'self',
    creatorName: '',
    classification: 'gen',
    model: 'wan'
  });
  
  // State for multiple videos
  const [videos, setVideos] = useState<VideoItem[]>([{
    id: crypto.randomUUID(),
    file: null,
    url: null
  }]);
  
  const updateLoraField = (field: keyof LoRAMetadata, value: any) => {
    setLoraMetadata(prev => ({ ...prev, [field]: value }));
  };
  
  const handleAddVideo = () => {
    setVideos([...videos, {
      id: crypto.randomUUID(),
      file: null,
      url: null
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
    setVideos(videos.map(video => 
      video.id === id ? { ...video, [field]: value } : video
    ));
  };
  
  const handleVideoFileDrop = (id: string) => {
    return (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        updateVideoField(id, 'file', file);
        updateVideoField(id, 'url', URL.createObjectURL(file));
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
    
    if (!loraMetadata.title) {
      toast.error('Please enter a title for the LoRA');
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
      
      // Submit each video with the same LoRA metadata
      for (const video of videos) {
        if (!video.file) continue;
        
        const videoMetadata: VideoMetadata = {
          title: loraMetadata.title,
          description: loraMetadata.description,
          creator: loraMetadata.creator,
          creatorName: loraMetadata.creator === 'someone_else' ? loraMetadata.creatorName : undefined,
          classification: loraMetadata.classification,
          model: loraMetadata.model
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
        <h1 className="text-3xl font-bold tracking-tight mb-4">Propose a LoRA</h1>
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
          
          {/* LoRA Information Section */}
          <div className="p-6 border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-semibold mb-4">LoRA Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lora-title">LoRA Title</Label>
                  <Input
                    type="text"
                    id="lora-title"
                    placeholder="Enter LoRA title"
                    value={loraMetadata.title}
                    onChange={(e) => updateLoraField('title', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="lora-description">Description</Label>
                  <Textarea
                    id="lora-description"
                    placeholder="Enter LoRA description"
                    value={loraMetadata.description}
                    onChange={(e) => updateLoraField('description', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label>Creator</Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="creator-self"
                        name="creator"
                        value="self"
                        checked={loraMetadata.creator === 'self'}
                        onChange={() => updateLoraField('creator', 'self')}
                        className="h-4 w-4"
                      />
                      <label htmlFor="creator-self">Self</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="creator-someone-else"
                        name="creator"
                        value="someone_else"
                        checked={loraMetadata.creator === 'someone_else'}
                        onChange={() => updateLoraField('creator', 'someone_else')}
                        className="h-4 w-4"
                      />
                      <label htmlFor="creator-someone-else">Someone Else</label>
                    </div>
                  </div>
                  {loraMetadata.creator === 'someone_else' && (
                    <div className="mt-2">
                      <Label htmlFor="creatorName">Creator's Name</Label>
                      <Input
                        type="text"
                        id="creatorName"
                        placeholder="Enter creator's name"
                        value={loraMetadata.creatorName}
                        onChange={(e) => updateLoraField('creatorName', e.target.value)}
                        required={loraMetadata.creator === 'someone_else'}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="classification">Classification</Label>
                  <Select 
                    value={loraMetadata.classification} 
                    onValueChange={(value) => updateLoraField('classification', value as 'art' | 'gen')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="art">Art</SelectItem>
                      <SelectItem value="gen">Gen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="model">Model</Label>
                  <Select 
                    value={loraMetadata.model} 
                    onValueChange={(value) => updateLoraField('model', value as 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wan">Wan</SelectItem>
                      <SelectItem value="hunyuan">Hunyuan</SelectItem>
                      <SelectItem value="ltxv">LTXV</SelectItem>
                      <SelectItem value="cogvideox">CogVideoX</SelectItem>
                      <SelectItem value="animatediff">AnimateDiff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          
          {/* Videos Section */}
          <h2 className="text-xl font-semibold">Videos</h2>
          
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
              
              {!video.file ? (
                <div className="w-full flex justify-center">
                  <VideoDropzone 
                    id={video.id} 
                    file={video.file} 
                    url={video.url} 
                    onDrop={handleVideoFileDrop(video.id)} 
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <VideoPreview 
                    file={video.file} 
                    className="w-full md:w-2/3 mx-auto"
                  />
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

// Component for video dropzone to avoid repetition
interface VideoDropzoneProps {
  id: string;
  file: File | null;
  url: string | null;
  onDrop: (acceptedFiles: File[]) => void;
}

const VideoDropzone: React.FC<VideoDropzoneProps> = ({ id, file, url, onDrop }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': []
    }
  });
  
  return (
    <div 
      {...getRootProps()} 
      className="dropzone mt-1 border-2 border-dashed rounded-md p-8 text-center cursor-pointer bg-muted/50 w-full md:w-1/2"
    >
      <input {...getInputProps()} id={`video-${id}`} />
      <div className="flex flex-col items-center justify-center">
        <UploadIcon className="h-12 w-12 text-muted-foreground mb-4" />
        {
          isDragActive ?
            <p>Drop the video here ...</p> :
            <>
              <p className="text-lg font-medium mb-2">Drag 'n' drop a video here</p>
              <p className="text-sm text-muted-foreground">or click to select a file</p>
            </>
        }
      </div>
    </div>
  );
};

export default Upload;
