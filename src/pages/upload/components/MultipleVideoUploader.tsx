import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, X } from 'lucide-react';
import VideoDropzoneComponent from '@/components/upload/VideoDropzone';
import VideoPreview from '@/components/VideoPreview';
import VideoMetadataForm from '@/components/upload/VideoMetadataForm';
import { toast } from 'sonner';
import { VideoMetadata } from '@/lib/types';

interface VideoMetadataForm {
  title: string;
  description: string;
  classification: 'art' | 'gen';
  creator: 'self' | 'someone_else';
  creatorName: string;
  isPrimary?: boolean;
}

interface VideoItem {
  id: string;
  file: File | null;
  url: string | null;
  metadata: VideoMetadataForm;
}

interface MultipleVideoUploaderProps {
  videos: VideoItem[];
  setVideos: React.Dispatch<React.SetStateAction<VideoItem[]>>;
}

const MultipleVideoUploader: React.FC<MultipleVideoUploaderProps> = ({ 
  videos, 
  setVideos 
}) => {
  // Initial empty video metadata
  const initialMetadata: VideoMetadataForm = {
    title: '',
    description: '',
    classification: 'gen',
    creator: 'self',
    creatorName: '',
    isPrimary: false,
  };

  // Ensure only one primary video is selected
  React.useEffect(() => {
    const primaryCount = videos.filter(v => v.metadata.isPrimary).length;
    
    // If no video is set as primary and we have videos, set the first one as primary
    if (primaryCount === 0 && videos.length > 0) {
      setVideos(prev => prev.map((video, index) => 
        index === 0 ? { ...video, metadata: { ...video.metadata, isPrimary: true } } : video
      ));
    }
    // If multiple videos are set as primary, keep only the most recently selected one
    else if (primaryCount > 1) {
      // Find the most recently selected primary video (last one in the array with isPrimary=true)
      const lastPrimaryIndex = [...videos].reverse().findIndex(v => v.metadata.isPrimary);
      if (lastPrimaryIndex !== -1) {
        const actualIndex = videos.length - 1 - lastPrimaryIndex;
        setVideos(prev => prev.map((video, index) => 
          ({ ...video, metadata: { ...video.metadata, isPrimary: index === actualIndex } })
        ));
      }
    }
  }, [videos, setVideos]);

  const handleAddVideo = () => {
    setVideos([...videos, {
      id: crypto.randomUUID(),
      file: null,
      url: null,
      metadata: {...initialMetadata, isPrimary: false}
    }]);
  };
  
  const handleRemoveVideo = (id: string) => {
    if (videos.length <= 1) {
      toast.error('You must have at least one video');
      return;
    }
    
    // Check if removing the primary video
    const isRemovingPrimary = videos.find(v => v.id === id)?.metadata.isPrimary;
    
    // Remove the video
    const updatedVideos = videos.filter(video => video.id !== id);
    
    // If we removed the primary video, set the first remaining video as primary
    if (isRemovingPrimary && updatedVideos.length > 0) {
      updatedVideos[0].metadata.isPrimary = true;
    }
    
    setVideos(updatedVideos);
  };
  
  const updateVideoMetadata = (id: string, field: keyof VideoMetadataForm, value: any) => {
    // If setting a video as primary, unset all others
    if (field === 'isPrimary' && value === true) {
      setVideos(prev => 
        prev.map(video => 
          video.id === id 
            ? { ...video, metadata: { ...video.metadata, [field]: value } } 
            : { ...video, metadata: { ...video.metadata, isPrimary: false } }
        )
      );
    } else {
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
    }
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
  
  const handleRemoveVideoFile = (id: string) => {
    setVideos(prev => 
      prev.map(video => 
        video.id === id ? { ...video, file: null, url: null } : video
      )
    );
  };

  return (
    <>
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
                  <div className="relative">
                    <VideoPreview 
                      file={video.file} 
                      className="w-full mx-auto"
                    />
                    <div className="absolute top-2 right-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveVideoFile(video.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : video.url ? (
                  <div className="relative">
                    <VideoPreview 
                      url={video.url} 
                      className="w-full mx-auto"
                    />
                    <div className="absolute top-2 right-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveVideoFile(video.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : null}
                
                <div className="mt-4">
                  <VideoMetadataForm
                    videoId={video.id}
                    metadata={video.metadata}
                    updateMetadata={updateVideoMetadata}
                    canSetPrimary={true}
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
    </>
  );
};

export default MultipleVideoUploader;
