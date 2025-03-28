
import React, { useState, useEffect } from 'react';
import { MultipleVideoUploader } from '@/pages/upload/components';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { videoUploadService } from '@/lib/services/videoUploadService';
import { VideoFile, VideoMetadata } from '@/lib/types';
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
  const [assetHasPrimaryMedia, setAssetHasPrimaryMedia] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Check if asset already has primary media when dialog opens
    if (open && assetId) {
      checkAssetHasPrimaryMedia();
    }
  }, [open, assetId]);

  const checkAssetHasPrimaryMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('primary_media_id')
        .eq('id', assetId)
        .single();
        
      if (!error && data) {
        setAssetHasPrimaryMedia(!!data.primary_media_id);
        console.log(`Asset ${assetId} has primary media: ${!!data.primary_media_id}`);
      }
    } catch (error) {
      console.error('Error checking asset primary media:', error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      // Reset the state when closing
      setVideos([]);
      setAssetHasPrimaryMedia(false);
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

      console.log(`Uploading ${videosWithContent.length} videos for LoRA ${assetName} (${assetId})`);
      
      // For existing LoRAs with primary media, we don't want to override unless explicitly set
      // For new LoRAs or those without primary media, allow the first to be primary if none is explicitly set
      const isPrimaryNeeded = !assetHasPrimaryMedia;
      const hasPrimaryVideo = videosWithContent.some(v => v.metadata.isPrimary === true);
      
      if (isPrimaryNeeded && !hasPrimaryVideo && videosWithContent.length > 0) {
        // If asset doesn't have a primary media and no video is marked as primary,
        // mark the first video as primary
        videosWithContent[0].metadata.isPrimary = true;
        console.log(`No primary media exists for asset ${assetId} and no video is marked as primary. Making first video primary.`);
      } else if (assetHasPrimaryMedia && !hasPrimaryVideo) {
        // If asset already has a primary media and no video is explicitly marked,
        // ensure we don't override it
        console.log(`Asset ${assetId} already has primary media. Not changing primary status.`);
      }
      
      // Process and upload all videos - USE SEPARATE FUNCTION FOR EXISTING ASSETS
      const uploadPromises = videosWithContent.map(async (video) => {
        if (video.file) {
          // File upload
          const videoMetadata: VideoMetadata = {
            ...video.metadata,
            loraName: assetName,
            assetId: assetId
          };

          console.log(`Uploading video: isPrimary=${video.metadata.isPrimary}, title=${video.metadata.title}`);

          const videoFile: VideoFile = {
            id: video.id,
            blob: video.file,
            metadata: videoMetadata
          };

          // Use the addVideoToExistingAsset method for existing assets
          return videoUploadService.uploadVideoToExistingAsset(
            videoFile, 
            assetId, 
            username, 
            user?.id,
            video.metadata.isPrimary || false
          );
        } else if (video.url) {
          // URL entry - use the addEntryToExistingAsset method
          console.log(`Adding video URL: isPrimary=${video.metadata.isPrimary}, title=${video.metadata.title}`);
          
          return videoUploadService.addEntryToExistingAsset({
            video_location: video.url,
            reviewer_name: username,
            skipped: false,
            user_id: user?.id || null,
            metadata: {
              ...video.metadata,
              loraName: assetName,
              assetId: assetId
            }
          }, assetId, video.metadata.isPrimary || false);
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

  console.log("LoRAVideoUploader rendering with assetId:", assetId, "user:", !!user, "assetHasPrimaryMedia:", assetHasPrimaryMedia);

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
              {assetHasPrimaryMedia && (
                <span className="block mt-2 text-amber-500">
                  This LoRA already has a primary video. New videos will only become primary if you explicitly mark them as such.
                </span>
              )}
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
