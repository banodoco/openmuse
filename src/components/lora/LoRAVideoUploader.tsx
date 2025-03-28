
import React, { useState } from 'react';
import { MultipleVideoUploader } from '@/pages/upload/components';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { videoUploadService } from '@/lib/services/videoUploadService';
import { VideoFile, VideoMetadata } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/hooks/useAuth';

interface VideoItem {
  id: string;
  file: File | null;
  url: string | null;
  metadata: VideoMetadataForm;
}

interface VideoMetadataForm {
  title: string;
  description: string;
  classification: 'art' | 'gen';
  creator: 'self' | 'someone_else';
  creatorName: string;
  isPrimary?: boolean;
}

interface LoRAVideoUploaderProps {
  assetId: string;
  assetName: string;
  onUploadsComplete: () => void;
}

const LoRAVideoUploader: React.FC<LoRAVideoUploaderProps> = ({ 
  assetId,
  assetName,
  onUploadsComplete
}) => {
  const [open, setOpen] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuth();

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      // Reset the state when closing
      setVideos([]);
    }
  };

  const uploadVideos = async () => {
    const videosWithContent = videos.filter(v => v.file || v.url);
    
    if (videosWithContent.length === 0) {
      toast.error('Please add at least one video');
      return;
    }

    setIsUploading(true);

    try {
      const username = user?.email || 'Anonymous';
      
      // Set the user ID for uploads
      if (user?.id) {
        videoUploadService.setCurrentUserId(user.id);
      }

      // Process and upload all videos
      const uploadPromises = videosWithContent.map(async (video) => {
        if (video.file) {
          // File upload
          const videoMetadata: VideoMetadata = {
            ...video.metadata,
            loraName: assetName,
            assetId: assetId
          };

          const videoFile: VideoFile = {
            id: video.id,
            blob: video.file,
            metadata: videoMetadata
          };

          return videoUploadService.uploadVideo(videoFile, username, user?.id);
        } else if (video.url) {
          // URL entry
          return videoUploadService.addEntry({
            video_location: video.url,
            reviewer_name: username,
            skipped: false,
            user_id: user?.id || null,
            metadata: {
              ...video.metadata,
              loraName: assetName,
              assetId: assetId
            }
          });
        }
        return null;
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(r => r !== null);

      if (successfulUploads.length > 0) {
        toast.success(`Successfully uploaded ${successfulUploads.length} videos`);
        // Close the dialog and reset
        setOpen(false);
        setVideos([]);
        onUploadsComplete();
      } else {
        toast.error('No videos were uploaded successfully');
      }
    } catch (error) {
      console.error('Error uploading videos:', error);
      toast.error('Failed to upload videos. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  console.log("LoRAVideoUploader rendering with assetId:", assetId, "user:", !!user);

  return (
    <>
      <Button 
        variant="default" 
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload Generation
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Videos for {assetName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Add videos showcasing generations you've created with this LoRA. The videos will be associated with this asset.
            </p>
            
            <MultipleVideoUploader
              videos={videos}
              setVideos={setVideos}
            />
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button 
                onClick={uploadVideos}
                disabled={isUploading || videos.every(v => !v.file && !v.url)}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Upload Videos'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoRAVideoUploader;
