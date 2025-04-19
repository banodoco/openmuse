import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

class ThumbnailService {
  private readonly BUCKET_NAME = 'thumbnails';

  async generateThumbnail(videoUrl: string): Promise<string | null> {
    try {
      // Create a video element to load the video
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous'; // Enable CORS for the video
      video.src = videoUrl;

      return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          // Set video to the first frame
          video.currentTime = 0;
        };

        video.onseeked = () => {
          try {
            // Create a canvas to draw the video frame
            const canvas = document.createElement('canvas');
            
            // --- Start Resize Logic ---
            const maxDim = 640;
            let targetWidth = video.videoWidth;
            let targetHeight = video.videoHeight;
            const aspectRatio = video.videoWidth / video.videoHeight;

            if (targetWidth > maxDim || targetHeight > maxDim) {
              if (aspectRatio >= 1) { // Landscape or square
                targetWidth = maxDim;
                targetHeight = Math.round(maxDim / aspectRatio);
              } else { // Portrait
                targetHeight = maxDim;
                targetWidth = Math.round(maxDim * aspectRatio);
              }
            }
            
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            // --- End Resize Logic ---
            
            // Draw the video frame to the canvas (now potentially scaled)
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            // Draw the original video onto the possibly smaller canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert the canvas to a blob
            canvas.toBlob(async (blob) => {
              if (!blob) {
                reject(new Error('Failed to generate thumbnail blob'));
                return;
              }

              // Upload the blob to Supabase storage
              const thumbnailPath = `${uuidv4()}.jpg`;
              const { error: uploadError } = await supabase.storage
                .from(this.BUCKET_NAME)
                .upload(thumbnailPath, blob, {
                  contentType: 'image/jpeg',
                  upsert: true
                });

              if (uploadError) {
                reject(uploadError);
                return;
              }

              // Get the public URL of the uploaded thumbnail
              const { data: urlData } = supabase.storage
                .from(this.BUCKET_NAME)
                .getPublicUrl(thumbnailPath);

              resolve(urlData.publicUrl);
            }, 'image/jpeg', 0.8);
          } catch (error) {
            reject(error);
          }
        };

        video.onerror = () => {
          reject(new Error('Failed to load video'));
        };
      });
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  }
}

export const thumbnailService = new ThumbnailService(); 