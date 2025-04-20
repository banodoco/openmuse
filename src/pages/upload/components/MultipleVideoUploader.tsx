
import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Upload, XCircle } from 'lucide-react';
import VideoDropzone from '@/components/upload/VideoDropzone';
import VideoMetadataForm from '@/components/upload/VideoMetadataForm';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface VideoItem {
  file: File | null;
  url: string | null;
  metadata: {
    title: string;
    description: string;
    classification: 'art' | 'generation';
    creator: 'self' | 'someone_else';
    creatorName: string;
    isPrimary?: boolean;
  };
  id: string;
}

interface MultipleVideoUploaderProps {
  videos: VideoItem[];
  setVideos: React.Dispatch<React.SetStateAction<VideoItem[]>>;
  disabled?: boolean;
  hideIsPrimary?: boolean;
  allowPrimarySelection?: boolean; // Add this prop
  availableLoras?: any[]; // Add this prop
  uploadContext?: string; // Add this prop
}

const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({
  videos,
  setVideos,
  disabled = false,
  hideIsPrimary = false,
  allowPrimarySelection = true,
  availableLoras = [],
  uploadContext = ''
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  
  const createEmptyVideoItem = (): VideoItem => ({
    file: null,
    url: null,
    metadata: {
      title: '',
      description: '',
      classification: 'generation',
      creator: 'self',
      creatorName: user?.email || '',
      isPrimary: videos.length === 0
    },
    id: uuidv4()
  });
  
  const handleFileDrop = (acceptedFiles: File[]) => {
    if (disabled) return;
    
    if (acceptedFiles.length > 0) {
      const videoFiles = acceptedFiles.filter(file => file.type.startsWith('video/'));
      
      if (videoFiles.length === 0) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload video files only.',
          variant: 'destructive'
        });
        return;
      }
      
      const newVideos = videoFiles.map((file, index) => {
        const isFirst = videos.length === 0 && index === 0;
        
        return {
          file,
          url: URL.createObjectURL(file),
          metadata: {
            title: '',
            description: '',
            classification: 'generation' as 'art' | 'generation',
            creator: 'self' as 'self' | 'someone_else',
            creatorName: user?.email || '',
            isPrimary: isFirst
          },
          id: uuidv4()
        } as VideoItem;
      });
      
      setVideos(prev => [...prev, ...newVideos]);
    }
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    if (!file.type.startsWith('video/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload video files only.',
        variant: 'destructive'
      });
      return;
    }
    
    const isFirst = videos.length === 0;
    
    setVideos(prev => [
      ...prev,
      {
        file,
        url: URL.createObjectURL(file),
        metadata: {
          title: '',
          description: '',
          classification: 'generation',
          creator: 'self',
          creatorName: user?.email || '',
          isPrimary: isFirst
        },
        id: uuidv4()
      }
    ]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleAddUrlVideo = () => {
    if (disabled) return;
    
    if (!urlInput) {
      toast({
        title: 'Missing URL',
        description: 'Please enter a valid video URL.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      new URL(urlInput);
      
      const isFirst = videos.length === 0;
      
      setVideos(prev => [
        ...prev,
        {
          file: null,
          url: urlInput,
          metadata: {
            title: '',
            description: '',
            classification: 'generation' as 'art' | 'generation',
            creator: 'self' as 'self' | 'someone_else',
            creatorName: user?.email || '',
            isPrimary: isFirst
          },
          id: uuidv4()
        }
      ]);
      
      setUrlInput('');
      toast({
        title: 'Video URL added',
        description: 'The video URL has been added to your upload list.',
      });
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid video URL.',
        variant: 'destructive'
      });
    }
  };
  
  const updateVideoMetadata = (id: string, field: string, value: any) => {
    if (disabled) return;
    
    setVideos(prev => {
      const updated = prev.map(video => {
        if (video.id === id) {
          if (field === 'isPrimary' && value === true) {
            return {
              ...video,
              metadata: { ...video.metadata, isPrimary: true }
            };
          }
          return {
            ...video,
            metadata: { ...video.metadata, [field]: value }
          };
        }
        
        if (field === 'isPrimary' && value === true) {
          return { ...video, metadata: { ...video.metadata, isPrimary: false } };
        }
        
        return video;
      });
      
      const primaryIndex = updated.findIndex(v => v.metadata.isPrimary);
      if (primaryIndex !== -1) {
          return updated.map((v, idx) => ({
              ...v,
              metadata: { ...v.metadata, isPrimary: idx === primaryIndex }
          }));
      } else if (updated.length > 0) {
          updated[0].metadata.isPrimary = true;
      }

      return updated;
    });
  };
  
  const removeVideo = (id: string) => {
    if (disabled) return;
    
    setVideos(prev => {
      const removingPrimary = prev.find(v => v.id === id)?.metadata.isPrimary;
      const filtered = prev.filter(video => video.id !== id);
      
      if (removingPrimary && filtered.length > 0 && !filtered.some(v => v.metadata.isPrimary)) {
        return filtered.map((video, index) => ({
          ...video,
          metadata: { ...video.metadata, isPrimary: index === 0 }
        }));
      }
      
      return filtered;
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="video/*"
            disabled={disabled}
          />
          
          <VideoDropzone 
            id="main-dropzone"
            file={null}
            url={null}
            onDrop={handleFileDrop} 
            disabled={disabled}
          />
        </div>
      </div>
      
      {videos.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Added Videos ({videos.length})</h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-1">
            {videos.map((video) => (
              <Card key={video.id} className="relative overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 bg-background/80 rounded-full"
                  onClick={() => removeVideo(video.id)}
                  disabled={disabled}
                >
                  <XCircle size={18} />
                  <span className="sr-only">Remove</span>
                </Button>
                
                <CardContent className="p-4 grid md:grid-cols-2 gap-6">
                  <div className="flex flex-col space-y-2">
                    <div className="aspect-video bg-muted rounded-md overflow-hidden">
                      {video.url ? (
                        <video
                          src={video.url}
                          controls
                          className="w-full h-full object-contain"
                          preload="metadata"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-muted-foreground">No video selected</span>
                        </div>
                      )}
                    </div>
                    
                    {!video.url && !video.file && (
                      <div className="flex justify-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={disabled}
                        >
                          <Upload size={16} className="mr-2" />
                          Upload
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <VideoMetadataForm
                      videoId={video.id}
                      metadata={video.metadata}
                      updateMetadata={updateVideoMetadata}
                      canSetPrimary={!hideIsPrimary}
                      disabled={disabled}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultipleVideoUploader;
