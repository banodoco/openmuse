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
  initialUploadType?: 'lora' | 'video';
}

const UploadContent: React.FC<UploadContentProps> = ({ 
  onSuccess,
  onCancel,
  initialUploadType = 'lora'
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState<'art' | 'generation'>('art');
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
      logger.error('Error uploading video:', error);
      throw error;
    }
    
    const videoUrl = `https://bvtvmocwczjyljqqtbca.supabase.co/storage/v1/object/public/videos/${fileName}`;
    return videoUrl;
  };
  
  const createVideoEntry = async (videoUrl: string) => {
    if (!user) {
      throw new Error("User not authenticated");
    }
    
    const metadata: VideoMetadata = {
      model,
      modelVariant,
      title,
      description,
      classification: classification,
      creator,
      creatorName,
      isPrimary
    };
    
    const db = await databaseSwitcher.getDatabase();
    return await db.addEntry({
      url: videoUrl,
      reviewer_name: creatorName || 'Unknown',
      skipped: false,
      user_id: user.id,
      metadata: metadata
    });
  };
  
  const { mutate: uploadAndCreate, isPending } = useMutation({
    mutationFn: async () => {
      if (!videoFile) {
        throw new Error("No video file selected");
      }
      
      const videoUrl = await uploadVideo(videoFile);
      return createVideoEntry(videoUrl);
    },
    onSuccess: () => {
      toast.success("Video uploaded and entry created successfully!");
      setTitle('');
      setDescription('');
      setVideoFile(null);
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      logger.error('Error during upload and create:', error);
      toast.error(`Error uploading video: ${error.message}`);
    }
  });
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
    }
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
    },
    maxFiles: 1
  });
  
  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-md shadow-md">
      <div {...getRootProps()} className="relative border-2 border-dashed rounded-md p-4 cursor-pointer">
        <input {...getInputProps()} />
        {
          isDragActive ?
            <p className="text-center text-gray-600">Drop the files here ...</p> :
            <p className="text-center text-gray-600">Drag 'n' drop a video file here, or click to select files</p>
        }
        {videoFile && (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <p className="text-center text-gray-600">Selected file: {videoFile.name}</p>
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <Label htmlFor="title">Title</Label>
        <Input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Video Title"
          className="mt-1"
        />
      </div>
      
      <div className="mt-4">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Video Description"
          className="mt-1"
        />
      </div>
      
      <div className="mt-4">
        <Label htmlFor="classification">Classification</Label>
        <Select value={classification} onValueChange={(value) => setClassification(value as 'art' | 'generation')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="art">Art</SelectItem>
            <SelectItem value="generation">Generation</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="mt-4">
        <Label htmlFor="creator">Creator</Label>
        <Select value={creator} onValueChange={(value) => setCreator(value as 'self' | 'someone_else')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Creator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self">Self</SelectItem>
            <SelectItem value="someone_else">Someone Else</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {creator === 'someone_else' && (
        <div className="mt-4">
          <Label htmlFor="creatorName">Creator Name</Label>
          <Input
            type="text"
            id="creatorName"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            placeholder="Creator Name"
            className="mt-1"
          />
        </div>
      )}

      <div className="mt-4">
        <Label htmlFor="model">Base Model</Label>
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

      <div className="mt-4">
        <Label htmlFor="modelVariant">Model Variant</Label>
        <Input
          type="text"
          id="modelVariant"
          value={modelVariant}
          onChange={(e) => setModelVariant(e.target.value)}
          placeholder="Model Variant"
          className="mt-1"
        />
      </div>
      
      <div className="flex justify-end gap-2 mt-6">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          className="w-full"
          onClick={() => uploadAndCreate()}
          disabled={isPending || !videoFile}
        >
          {isPending ? 'Uploading...' : 'Upload Video'}
        </Button>
      </div>
    </div>
  );
};

export default UploadContent;
