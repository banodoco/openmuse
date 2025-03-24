
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
import { PlusCircle, X } from 'lucide-react';

const logger = new Logger('Upload');

// Interface for a video item in the upload form
interface VideoItem {
  id: string;
  file: File | null;
  url: string | null;
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
  
  // State for multiple videos
  const [videos, setVideos] = useState<VideoItem[]>([{
    id: crypto.randomUUID(),
    file: null,
    url: null,
    title: '',
    description: '',
    creator: 'self',
    creatorName: '',
    classification: 'gen',
    model: 'wan'
  }]);
  
  const handleAddVideo = () => {
    setVideos([...videos, {
      id: crypto.randomUUID(),
      file: null,
      url: null,
      title: '',
      description: '',
      creator: 'self',
      creatorName: '',
      classification: 'gen',
      model: 'wan'
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
    
    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const db = await databaseSwitcher.getDatabase();
      const reviewerName = user?.email || nameInput;
      
      // Submit each video
      for (const video of videos) {
        if (!video.file) continue;
        
        const videoMetadata: VideoMetadata = {
          title: video.title,
          description: video.description,
          creator: video.creator,
          creatorName: video.creator === 'someone_else' ? video.creatorName : undefined,
          classification: video.classification,
          model: video.model
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
          
          {videos.map((video, index) => (
            <div key={video.id} className="p-6 border rounded-lg bg-card space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Video {index + 1}</h2>
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`title-${video.id}`}>Video Title</Label>
                    <Input
                      type="text"
                      id={`title-${video.id}`}
                      placeholder="Enter video title"
                      value={video.title}
                      onChange={(e) => updateVideoField(video.id, 'title', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`description-${video.id}`}>Video Description</Label>
                    <Textarea
                      id={`description-${video.id}`}
                      placeholder="Enter video description"
                      value={video.description}
                      onChange={(e) => updateVideoField(video.id, 'description', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Creator</Label>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`creator-self-${video.id}`}
                          name={`creator-${video.id}`}
                          value="self"
                          checked={video.creator === 'self'}
                          onChange={() => updateVideoField(video.id, 'creator', 'self')}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`creator-self-${video.id}`}>Self</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`creator-someone-else-${video.id}`}
                          name={`creator-${video.id}`}
                          value="someone_else"
                          checked={video.creator === 'someone_else'}
                          onChange={() => updateVideoField(video.id, 'creator', 'someone_else')}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`creator-someone-else-${video.id}`}>Someone Else</label>
                      </div>
                    </div>
                    {video.creator === 'someone_else' && (
                      <div className="mt-2">
                        <Label htmlFor={`creatorName-${video.id}`}>Creator's Name</Label>
                        <Input
                          type="text"
                          id={`creatorName-${video.id}`}
                          placeholder="Enter creator's name"
                          value={video.creatorName}
                          onChange={(e) => updateVideoField(video.id, 'creatorName', e.target.value)}
                          required={video.creator === 'someone_else'}
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`classification-${video.id}`}>Classification</Label>
                    <Select 
                      value={video.classification} 
                      onValueChange={(value) => updateVideoField(video.id, 'classification', value as 'art' | 'gen')}
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
                    <Label htmlFor={`model-${video.id}`}>Model</Label>
                    <Select 
                      value={video.model} 
                      onValueChange={(value) => updateVideoField(video.id, 'model', value as 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff')}
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
                  
                  <div className="w-full">
                    <Label htmlFor={`video-${video.id}`}>Video File</Label>
                    <VideoDropzone 
                      id={video.id} 
                      file={video.file} 
                      url={video.url} 
                      onDrop={handleVideoFileDrop(video.id)} 
                    />
                  </div>
                </div>
              </div>
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
    <div {...getRootProps()} className="dropzone mt-1 border-2 border-dashed rounded-md p-4 text-center cursor-pointer bg-muted/50">
      <input {...getInputProps()} id={`video-${id}`} />
      {
        isDragActive ?
          <p>Drop the video here ...</p> :
          <p>Drag 'n' drop a video here, or click to select a file</p>
      }
      {file && (
        <div className="mt-2">
          <p>Selected file: {file.name}</p>
          <VideoPreview file={file} className="mt-2 mx-auto max-w-md" />
        </div>
      )}
    </div>
  );
};

export default Upload;
