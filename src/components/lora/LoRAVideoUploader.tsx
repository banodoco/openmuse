
import React, { useState, useEffect } from 'react';
import { MultipleVideoUploader } from '@/pages/upload/components';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { videoUploadService } from '@/lib/services/videoUploadService';
import { VideoFile, VideoMetadata } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface VideoItem {
  id: string;
  file: File | null;
  url: string | null;
  metadata: VideoMetadataForm;
}

interface VideoMetadataForm {
  title: string;
  description: string;
  classification: 'art' | 'generation';
  creator: 'self' | 'someone_else';
  creatorName: string;
  isPrimary?: boolean;
}

interface LoRAVideoUploaderProps {
  assetId: string;
  assetName: string;
  onUploadsComplete: () => void;
  isLoggedIn: boolean;
}

const LoRAVideoUploader: React.FC<LoRAVideoUploaderProps> = ({ 
  assetId,
  assetName,
  onUploadsComplete,
  isLoggedIn
}) => {
  const [open, setOpen] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setVideos([]);
    }
  };

  const handleSignIn = () => {
    const returnUrl = window.location.pathname;
    navigate(`/auth?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  const uploadVideos = async () => {
    if (!isLoggedIn) {
      handleSignIn();
      return;
    }
    
    const videosWithContent = videos.filter(v => v.file || v.url);
    
    if (videosWithContent.length === 0) {
      toast.error('Please add at least one video');
      return;
    }

    setIsUploading(true);

    try {
      const username = user?.email || 'Anonymous';
      
      if (user?.id) {
        videoUploadService.setCurrentUserId(user.id);
      }

      console.log(`Uploading ${videosWithContent.length} videos for LoRA ${assetName} (${assetId})`);
      
      const uploadPromises = videosWithContent.map(async (video) => {
        if (video.file) {
          const title = video.metadata.title;
          const description = video.metadata.description;
          const classification = video.metadata.classification;
          const creator = video.metadata.creator;
          const creatorName = video.metadata.creatorName;

          const metadata: VideoMetadata = {
            loraName: assetName,
            assetId,
            isPrimary: false,
            title,
            description,
            classification, // This is now correctly typed as 'art' | 'generation'
            creator,
            creatorName
          };

          console.log(`Uploading video: title=${video.metadata.title}, assetId=${assetId}`);

          const videoFile: VideoFile = {
            id: video.id,
            blob: video.file,
            metadata
          };

          return videoUploadService.uploadVideoToExistingAsset(
            videoFile, 
            assetId, 
            username, 
            user?.id,
            false
          );
        } else if (video.url) {
          console.log(`Adding video URL: title=${video.metadata.title}, assetId=${assetId}`);
          
          return videoUploadService.addEntryToExistingAsset({
            url: video.url,
            reviewer_name: username,
            skipped: false,
            user_id: user?.id || null,
            metadata: {
              ...video.metadata,
              loraName: assetName,
              assetId,
              isPrimary: false
            }
          }, assetId, false);
        }
        return null;
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(r => r !== null);

      if (successfulUploads.length > 0) {
        toast.success(`Successfully uploaded ${successfulUploads.length} videos`);
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

  return (
    <>
      <Button 
        variant="secondary"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload Video
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Videos for {assetName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {!isLoggedIn ? (
              <div className="rounded-md bg-muted/50 p-6 text-center">
                <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Login Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You need to be logged in to upload videos.
                </p>
                <Button onClick={handleSignIn}>
                  Sign In to Continue
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Add videos showcasing generations you've created with this LoRA. The videos will be associated with this asset.
                </p>
                
                <MultipleVideoUploader
                  videos={videos}
                  setVideos={setVideos}
                  allowPrimarySelection={false}
                  availableLoras={[]}
                  uploadContext="lora"
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoRAVideoUploader;
