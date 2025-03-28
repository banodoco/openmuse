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
  const initialMetadata: VideoMetadataForm = {
    title: '',
    description: '',
    classification: 'gen',
    creator: 'self',
    creatorName: '',
    isPrimary: false,
  };

  React.useEffect(() => {
    const primaryCount = videos.filter(v => v.metadata.isPrimary).length;
    
    if (primaryCount === 0 && videos.length > 0) {
      setVideos(prev => prev.map((video, index) => 
        index === 0 ? { ...video, metadata: { ...video.metadata, isPrimary: true } } : video
      ));
    }
    else if (primaryCount > 1) {
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
    
    const isRemovingPrimary = videos.find(v => v.id === id)?.metadata.isPrimary;
    
    const updatedVideos = videos.filter(video => video.id !== id);
    
    if (isRemovingPrimary && updatedVideos.length > 0) {
      updatedVideos[0].metadata.isPrimary = true;
    }
    
    setVideos(updatedVideos);
  };
  
  const updateVideoMetadata = (id: string, field: keyof VideoMetadataForm, value: any) => {
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
        
        const fileName = file.name;
        const fileNameWithoutExtension = fileName.split('.').slice(0, -1).join('.');
        const defaultTitle = fileNameWithoutExtension || fileName;
        
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
      
      let defaultTitle = '';
      
      try {
        if (linkUrl.includes('youtube.com/') || linkUrl.includes('youtu.be/')) {
          const url = new URL(linkUrl);
          const videoId = url.searchParams.get('v') || 
                          linkUrl.split('/').pop()?.split('?')[0] || 
                          'YouTube Video';
          defaultTitle = `YouTube Video - ${videoId}`;
        } 
        else if (linkUrl.includes('vimeo.com/')) {
          const videoId = linkUrl.split('/').pop() || 'Vimeo Video';
          defaultTitle = `Vimeo Video - ${videoId}`;
        }
        else {
          const fileName = linkUrl.split('/').pop() || 'Video';
          const fileNameWithoutExtension = fileName.split('.').slice(0, -1).join('.');
          defaultTitle = fileNameWithoutExtension || fileName;
        }
      } catch (e) {
        defaultTitle = 'External Video';
      }
      
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
            
            <div className="w-full flex justify-center">
              <VideoDropzoneComponent 
                id={video.id} 
                file={video.file} 
                url={video.url} 
                onDrop={handleVideoFileDrop(video.id)}
                onLinkAdded={handleVideoLinkAdded(video.id)}
              />
            </div>
            
            {video.file || video.url ? (
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
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
};

export default MultipleVideoUploader;
