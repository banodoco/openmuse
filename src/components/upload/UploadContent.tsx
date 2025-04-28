import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { VideoMetadata } from '@/lib/types';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { Logger } from '@/lib/logger';

const logger = new Logger('UploadContent');

interface UploadContentProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  refetchVideos?: () => Promise<void> | void;
  initialUploadType?: 'lora' | 'video';
}

const UploadContent: React.FC<UploadContentProps> = ({ 
  onSuccess,
  onCancel,
  refetchVideos,
  initialUploadType = 'lora'
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState<'art' | 'gen'>('gen');
  const [creator, setCreator] = useState<'self' | 'someone_else'>('self');
  const [creatorName, setCreatorName] = useState('');
  const [model, setModel] = useState<'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff'>('wan');
  const [modelVariant, setModelVariant] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const { user } = useAuth();
  
  const uploadVideo = async (file: File) => {
    if (!user) {
      throw new Error("User not authenticated");
    }
    logger.log('Starting video upload...');
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase
      .storage
      .from('videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      logger.error('Error uploading video to storage:', error);
      throw error;
    }
    
    logger.log('Video uploaded to storage successfully:', data);
    const videoUrl = `https://bvtvmocwczjyljqqtbca.supabase.co/storage/v1/object/public/videos/${fileName}`;
    return videoUrl;
  };
  
  const createVideoMetadata = (data: any): VideoMetadata => ({
    title: data.title || 'Untitled',
    description: data.description || '',
    classification: data.classification || 'art',
    creatorName: data.creatorName,
    isPrimary: data.isPrimary,
    loraName: data.loraName,
    loraDescription: data.loraDescription,
    assetId: data.assetId,
    loraType: data.loraType,
    loraLink: data.loraLink,
    model: data.model,
    modelVariant: data.modelVariant,
    baseModel: data.baseModel,
    placeholder_image: data.placeholder_image,
    trainingSteps: data.trainingSteps,
    resolution: data.resolution,
    trainingDataset: data.trainingDataset,
    aspectRatio: data.aspectRatio,
    associatedLoraIds: data.associatedLoraIds
  });
  
  const createVideoEntry = async (videoUrl: string) => {
    if (!user) {
      throw new Error("User not authenticated for creating entry");
    }
    logger.log('Creating video entry in database...');
    const metadata = createVideoMetadata({
      title,
      description,
      classification,
      creator,
      creatorName,
      isPrimary
    });
    
    const db = await databaseSwitcher.getDatabase();
    const result = await db.addEntry({
      url: videoUrl,
      reviewer_name: creatorName || 'Unknown',
      skipped: false,
      user_id: user.id,
      metadata: metadata
    });
    logger.log('Video entry created:', result);
    return result;
  };
  
  const { mutate: uploadAndCreate, isPending } = useMutation({
    mutationFn: async () => {
      logger.log('Mutation function started.');
      if (!videoFile) {
        throw new Error("No video file selected");
      }
      
      const videoUrl = await uploadVideo(videoFile);
      const entryResult = await createVideoEntry(videoUrl);
      logger.log('Mutation function completed successfully.');
      return entryResult;
    },
    onSuccess: (data) => {
      logger.log('Mutation onSuccess started. Data:', data);
      toast.success("Video uploaded and entry created successfully!");
      logger.log('Resetting form state...');
      setTitle('');
      setDescription('');
      setVideoFile(null);
      setCreator('self');
      setCreatorName('');
      logger.log('Form state reset.');

      if (onSuccess) {
        logger.log('Calling external onSuccess callback...');
        onSuccess();
        logger.log('External onSuccess callback finished.');
      }
      
      if (refetchVideos) {
          logger.log('Calling refetchVideos...');
          Promise.resolve(refetchVideos()).catch(err => {
              logger.error('Error calling refetchVideos:', err);
          }).finally(() => {
              logger.log('refetchVideos call finished.');
          });
      } else {
          logger.warn('refetchVideos prop was not provided.');
      }
      logger.log('Mutation onSuccess finished.');
    },
    onError: (error: any) => {
      logger.error('Mutation onError triggered. Error:', error);
      if (error.name === 'AbortError') {
        toast.warning("Upload cancelled or interrupted.");
      } else {
        toast.error(`Error uploading video: ${error.message || 'Unknown error'}`);
      }
      logger.error('Mutation onError finished.');
    },
    onSettled: () => {
       logger.log('Mutation onSettled triggered (runs after onSuccess or onError).');
    }
  });
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      logger.log('File dropped:', acceptedFiles[0].name);
      setVideoFile(acceptedFiles[0]);
    } else {
      logger.log('Invalid file dropped or drop cancelled.');
    }
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
    },
    maxFiles: 1,
    disabled: isPending
  });
  
  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-card text-card-foreground rounded-lg shadow-md border">
      <form onSubmit={(e) => { e.preventDefault(); uploadAndCreate(); }}>
        <div {...getRootProps()} 
             className={`relative border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors duration-200 ease-in-out ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/50'} ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
          <input {...getInputProps()} />
          {
            videoFile ? (
              <p className="text-sm font-medium text-foreground">Selected: {videoFile.name}</p>
            ) : isDragActive ? (
              <p className="text-sm text-muted-foreground">Drop the video file here...</p>
            ) : (
              <p className="text-sm text-muted-foreground">Drag & drop video, or click to select</p>
            )
          }
        </div>
        
        {videoFile && !isPending && (
             <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => setVideoFile(null)}>Clear selection</Button>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video Title"
              className="mt-1"
              required
              disabled={isPending}
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Video Description"
              className="mt-1"
              disabled={isPending}
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="classification">Classification</Label>
              <Select value={classification} onValueChange={(value) => setClassification(value as 'art' | 'gen')} disabled={isPending}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gen">Generation</SelectItem>
                  <SelectItem value="art">Art</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="creator">Creator</Label>
              <Select value={creator} onValueChange={(value) => setCreator(value as 'self' | 'someone_else')} disabled={isPending}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select Creator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self</SelectItem>
                  <SelectItem value="someone_else">Someone Else</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {creator === 'someone_else' && (
            <div>
              <Label htmlFor="creatorName">Creator Name</Label>
              <Input
                type="text"
                id="creatorName"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Creator Name"
                className="mt-1"
                disabled={isPending}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="model">Base Model</Label>
              <Select value={model} onValueChange={(value) => setModel(value as 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff')} disabled={isPending}>
                <SelectTrigger className="w-full mt-1">
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

            <div>
              <Label htmlFor="modelVariant">Model Variant</Label>
              <Input
                type="text"
                id="modelVariant"
                value={modelVariant}
                onChange={(e) => setModelVariant(e.target.value)}
                placeholder="Optional variant details"
                className="mt-1"
                disabled={isPending}
              />
            </div>
         </div>
          
          {/* Add isPrimary checkbox if needed */}

        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className="min-w-[120px]"
            disabled={isPending || !videoFile || !title}
          >
            {isPending ? 'Uploading...' : 'Upload Video'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UploadContent;
