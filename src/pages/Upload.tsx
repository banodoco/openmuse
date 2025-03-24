
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

const logger = new Logger('Upload');

const Upload: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creator, setCreator] = useState<'self' | 'someone_else'>('self');
  const [creatorName, setCreatorName] = useState('');
  const [classification, setClassification] = useState<'art' | 'gen'>('gen');
  const [model, setModel] = useState<'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff'>('wan');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': []
    }
  });
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!videoFile) {
      toast.error('Please upload a video');
      return;
    }
    
    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const db = await databaseSwitcher.getDatabase();
      
      const videoMetadata: VideoMetadata = {
        title,
        description,
        creator,
        creatorName: creator === 'someone_else' ? creatorName : undefined,
        classification,
        model
      };
      
      // Get user's email or name if available, otherwise use the nameInput field
      const reviewerName = user?.email || nameInput;
      
      const newEntry: Omit<VideoEntry, "id" | "created_at" | "admin_approved"> = {
        video_location: videoUrl || 'error',
        reviewer_name: reviewerName,
        skipped: false,
        user_id: user?.id || null,
        metadata: videoMetadata
      };
      
      await db.createEntry(newEntry);
      
      toast.success('Video submitted successfully! Awaiting admin approval.');
      navigate('/');
    } catch (error: any) {
      console.error('Error submitting video:', error);
      toast.error(error.message || 'Failed to submit video');
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
          Submit your video to be reviewed and added to the curated list.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
          
          <div>
            <Label htmlFor="title">Video Title</Label>
            <Input
              type="text"
              id="title"
              placeholder="Enter video title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Video Description</Label>
            <Textarea
              id="description"
              placeholder="Enter video description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                  checked={creator === 'self'}
                  onChange={() => setCreator('self')}
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
                  checked={creator === 'someone_else'}
                  onChange={() => setCreator('someone_else')}
                  className="h-4 w-4"
                />
                <label htmlFor="creator-someone-else">Someone Else</label>
              </div>
            </div>
            {creator === 'someone_else' && (
              <div className="mt-2">
                <Label htmlFor="creatorName">Creator's Name</Label>
                <Input
                  type="text"
                  id="creatorName"
                  placeholder="Enter creator's name"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  required={creator === 'someone_else'}
                />
              </div>
            )}
          </div>
          
          <div>
            <Label htmlFor="classification">Classification</Label>
            <Select value={classification} onValueChange={(value) => setClassification(value as 'art' | 'gen')}>
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
            <Select value={model} onValueChange={(value) => setModel(value as 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff')}>
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
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
            />
            <Label htmlFor="terms">I accept the terms and conditions</Label>
          </div>
          
          {/* Moved Video File section to the bottom */}
          <div>
            <Label htmlFor="video">Video File</Label>
            <div {...getRootProps()} className="dropzone mt-1 border-2 border-dashed rounded-md p-4 text-center cursor-pointer bg-muted/50">
              <input {...getInputProps()} id="video" />
              {
                isDragActive ?
                  <p>Drop the video here ...</p> :
                  <p>Drag 'n' drop a video here, or click to select a file</p>
              }
              {videoFile && (
                <div className="mt-2">
                  <p>Selected file: {videoFile.name}</p>
                  <VideoPreview file={videoFile} className="mt-2 mx-auto max-w-md" />
                </div>
              )}
            </div>
          </div>

          {/* Example Upload Section */}
          <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-muted">
            <h3 className="text-lg font-medium mb-2">Example Upload</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Sample video with LoRA applied:</p>
                <div className="aspect-video bg-muted rounded flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Sample video preview</p>
                </div>
              </div>
              <div>
                <h4 className="text-md font-medium mb-1">Sample Details</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>Title: Cyberpunk City Animation</li>
                  <li>Model: Wan</li>
                  <li>Classification: Art</li>
                  <li>Creator: John Doe</li>
                </ul>
              </div>
            </div>
          </div>
          
          <Button type="submit" disabled={isSubmitting} size={isMobile ? "sm" : "default"}>
            {isSubmitting ? 'Submitting...' : 'Submit Video'}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default Upload;
