
import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Upload, XCircle, Link } from 'lucide-react';
import VideoDropzone from '@/components/upload/VideoDropzone';
import VideoMetadataForm from '@/components/upload/VideoMetadataForm';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';

// Define the shape of a video item
interface VideoItem {
  file: File | null;
  url: string | null;
  metadata: {
    title: string;
    description: string;
    classification: 'art' | 'gen';
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
}

const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({ 
  videos, 
  setVideos,
  disabled = false
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [urlInput, setUrlInput] = useState('');
  
  // Helper to create an empty video item
  const createEmptyVideoItem = (): VideoItem => ({
    file: null,
    url: null,
    metadata: {
      title: '',
      description: '',
      classification: 'art',
      creator: 'self',
      creatorName: user?.email || '',
      isPrimary: videos.length === 0 // First video is primary by default
    },
    id: uuidv4()
  });
  
  // Handle file drops from the dropzone
  const handleFileDrop = (acceptedFiles: File[]) => {
    if (disabled) return;
    
    if (acceptedFiles.length > 0) {
      // Filter for video files and add each one
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
            title: file.name.split('.')[0], // Use filename as default title
            description: '',
            classification: 'art',
            creator: 'self',
            creatorName: user?.email || '',
            isPrimary: isFirst // First video is primary by default
          },
          id: uuidv4()
        };
      });
      
      setVideos(prev => [...prev, ...newVideos]);
      setActiveTab('upload'); // Switch to upload tab after dropping files
    }
  };
  
  // Handle manual file selection
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
          title: file.name.split('.')[0], // Use filename as default title
          description: '',
          classification: 'art',
          creator: 'self',
          creatorName: user?.email || '',
          isPrimary: isFirst // First video is primary by default
        },
        id: uuidv4()
      }
    ]);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Add a URL video
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
      new URL(urlInput); // Validate URL format
      
      const isFirst = videos.length === 0;
      
      setVideos(prev => [
        ...prev,
        {
          file: null,
          url: urlInput,
          metadata: {
            title: 'Video from URL',
            description: '',
            classification: 'art',
            creator: 'self',
            creatorName: user?.email || '',
            isPrimary: isFirst // First video is primary by default
          },
          id: uuidv4()
        }
      ]);
      
      setUrlInput(''); // Clear URL input
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
  
  // Update video metadata
  const updateVideoMetadata = (id: string, field: string, value: any) => {
    if (disabled) return;
    
    setVideos(prev => {
      const updated = prev.map(video => {
        if (video.id === id) {
          return {
            ...video,
            metadata: {
              ...video.metadata,
              [field]: value
            }
          };
        }
        
        // If setting this video as primary, unset primary from all others
        if (field === 'isPrimary' && value === true) {
          return {
            ...video,
            metadata: {
              ...video.metadata,
              isPrimary: video.id === id
            }
          };
        }
        
        return video;
      });
      
      return updated;
    });
  };
  
  // Remove a video
  const removeVideo = (id: string) => {
    if (disabled) return;
    
    setVideos(prev => {
      // Check if we're removing the primary video
      const removingPrimary = prev.find(v => v.id === id)?.metadata.isPrimary;
      const filtered = prev.filter(video => video.id !== id);
      
      // If we removed the primary and have other videos, make the first one primary
      if (removingPrimary && filtered.length > 0) {
        return filtered.map((video, index) => {
          if (index === 0) {
            return {
              ...video,
              metadata: {
                ...video.metadata,
                isPrimary: true
              }
            };
          }
          return video;
        });
      }
      
      return filtered;
    });
  };
  
  // Add empty video card
  const addEmptyVideo = () => {
    if (disabled) return;
    
    setVideos(prev => [...prev, createEmptyVideoItem()]);
  };
  
  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="link">Add Video Links</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="space-y-4">
          <VideoDropzone 
            onDrop={handleFileDrop} 
            disabled={disabled}
          />
          
          <div className="flex items-center justify-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="video/*"
              disabled={disabled}
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex items-center gap-2"
            >
              <Upload size={16} />
              Select Video File
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="link" className="space-y-4">
          <div className="grid gap-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="video-url">Video URL</Label>
              <div className="flex gap-2">
                <Input
                  id="video-url"
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={disabled}
                  className="flex-1"
                />
                <Button 
                  onClick={handleAddUrlVideo}
                  disabled={!urlInput || disabled}
                >
                  <Link size={16} className="mr-2" />
                  Add
                </Button>
              </div>
            </div>
            
            <Alert>
              <AlertDescription>
                Add a direct URL to a video file (MP4, WebM, etc.) or a link from YouTube, Vimeo, etc.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>
      </Tabs>
      
      {videos.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Added Videos ({videos.length})</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addEmptyVideo}
              disabled={disabled}
            >
              Add Empty Slot
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-1">
            {videos.map((video, index) => (
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('link')}
                          disabled={disabled}
                        >
                          <Link size={16} className="mr-2" />
                          Add URL
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <VideoMetadataForm
                      videoId={video.id}
                      metadata={video.metadata}
                      updateMetadata={updateVideoMetadata}
                      canSetPrimary={true}
                      disabled={disabled}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-center">
          <h3 className="mb-2 text-lg font-medium">No Videos Added</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload files or add video links to get started.
          </p>
        </div>
      )}
    </div>
  );
};

export default MultipleVideoUploader;
