import { supabase } from '@/integrations/supabase/client';
import { VideoMetadata, VideoEntry } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@/lib/logger';

const logger = new Logger('videoUploadService');

// Function to generate a unique video ID
const generateVideoId = (): string => {
  return uuidv4();
};

// Function to upload a single video to Supabase storage
export const uploadVideoToStorage = async (
  video: File,
  userId: string,
  assetId?: string
): Promise<{ videoPath: string; thumbnailPath: string }> => {
  const videoId = generateVideoId();
  const videoPath = `videos/${userId}/${assetId ? `${assetId}/` : ''}${videoId}-${video.name}`;
  const thumbnailPath = `thumbnails/${userId}/${assetId ? `${assetId}/` : ''}${videoId}-thumbnail.jpg`;

  try {
    // Upload video
    const { error: videoError } = await supabase.storage
      .from('videos')
      .upload(videoPath, video, {
        cacheControl: '3600',
        upsert: false
      });

    if (videoError) {
      logger.error('Error uploading video:', videoError);
      throw new Error(`Video upload failed: ${videoError.message}`);
    }

    // Generate thumbnail (mocked for now)
    // In a real implementation, you would generate a thumbnail from the video
    // and upload it to Supabase storage.
    const { data: thumbnailUrl } = supabase.storage
      .from('thumbnails')
      .getPublicUrl('placeholder.jpg');

    return { videoPath, thumbnailPath };
  } catch (error: any) {
    logger.error('Error in uploadVideoToStorage:', error);
    throw new Error(`Failed to upload video: ${error.message}`);
  }
};

// Function to create a media entry in Supabase database
export const createMediaFromVideo = async (
  videoPath: string,
  thumbnailPath: string,
  videoMetadata: VideoMetadata,
  userId: string,
  assetId?: string,
  aspectRatio?: number,
  creator?: string,
  placeholder_image?: string
): Promise<VideoEntry> => {
  const videoId = generateVideoId();
  const publicVideoUrl = supabase.storage.from('videos').getPublicUrl(videoPath).data.publicUrl;
  const publicThumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(placeholder_image || 'placeholder.jpg').data.publicUrl;

  // Fix the metadata object to ensure classification is always set
  const metadata: VideoMetadata = {
    title: videoMetadata.title,
    description: videoMetadata.description,
    assetId: assetId,
    creatorName: videoMetadata.creatorName,
    creator: videoMetadata.creator,
    classification: videoMetadata.classification || 'gen', // Provide default for required field
    isPrimary: videoMetadata.isPrimary,
    loraName: videoMetadata.loraName,
    loraDescription: videoMetadata.loraDescription,
    loraType: videoMetadata.loraType,
    loraLink: videoMetadata.loraLink,
    model: videoMetadata.model,
    modelVariant: videoMetadata.modelVariant,
    baseModel: videoMetadata.baseModel,
    placeholder_image: placeholder_image,
    trainingSteps: videoMetadata.trainingSteps,
    resolution: videoMetadata.resolution,
    trainingDataset: videoMetadata.trainingDataset,
    aspectRatio: aspectRatio,
    associatedLoraIds: videoMetadata.associatedLoraIds
  };

  try {
    const { data, error } = await supabase
      .from('media')
      .insert([
        {
          id: videoId,
          url: publicVideoUrl,
          title: videoMetadata.title,
          description: videoMetadata.description,
          creator: creator || userId,
          user_id: userId,
          type: 'video',
          metadata: metadata,
          placeholder_image: publicThumbnailUrl,
          classification: videoMetadata.classification || 'gen',
        }
      ])
      .select()

    if (error) {
      logger.error('Error creating media entry:', error);
      throw new Error(`Failed to create media entry: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("No data returned when creating media entry.");
    }

    return data[0] as VideoEntry;
  } catch (error: any) {
    logger.error('Error in createMediaFromVideo:', error);
    throw new Error(`Failed to create media entry: ${error.message}`);
  }
};

// Function to create a media entry from an existing video in Supabase database
export const createMediaFromExistingVideo = async (
  videoMetadata: VideoMetadata,
  userId: string,
  assetId?: string,
  aspectRatio?: number,
  creator?: string,
  placeholder_image?: string,
  videoUrl?: string
): Promise<VideoEntry | null> => {
  if (!videoUrl) {
    logger.error('Video URL is required for creating media from existing video.');
    return null;
  }

  const videoId = generateVideoId();
  const publicThumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(placeholder_image || 'placeholder.jpg').data.publicUrl;

  const metadata: VideoMetadata = {
    title: videoMetadata.title,
    description: videoMetadata.description,
    assetId: assetId,
    creatorName: videoMetadata.creatorName,
    creator: videoMetadata.creator,
    classification: videoMetadata.classification || 'gen', // Provide default for required field
    isPrimary: videoMetadata.isPrimary,
    loraName: videoMetadata.loraName,
    loraDescription: videoMetadata.loraDescription,
    loraType: videoMetadata.loraType,
    loraLink: videoMetadata.loraLink,
    model: videoMetadata.model,
    modelVariant: videoMetadata.modelVariant,
    baseModel: videoMetadata.baseModel,
    placeholder_image: placeholder_image,
    trainingSteps: videoMetadata.trainingSteps,
    resolution: videoMetadata.resolution,
    trainingDataset: videoMetadata.trainingDataset,
    aspectRatio: aspectRatio,
    associatedLoraIds: videoMetadata.associatedLoraIds
  };

  try {
    const { data, error } = await supabase
      .from('media')
      .insert([
        {
          id: videoId,
          url: videoUrl,
          title: videoMetadata.title,
          description: videoMetadata.description,
          creator: creator || userId,
          user_id: userId,
          type: 'video',
          metadata: metadata,
          placeholder_image: publicThumbnailUrl,
          classification: videoMetadata.classification || 'gen',
        }
      ])
      .select()

    if (error) {
      logger.error('Error creating media entry from existing video:', error);
      throw new Error(`Failed to create media entry from existing video: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("No data returned when creating media entry from existing video.");
    }

    return data[0] as VideoEntry;
  } catch (error: any) {
    logger.error('Error in createMediaFromExistingVideo:', error);
    throw new Error(`Failed to create media entry from existing video: ${error.message}`);
  }
};

// Function to upload multiple videos to Supabase storage
export const uploadMultipleVideosToStorage = async (
  videos: { file: File; metadata: VideoMetadata }[],
  userId: string,
  assetId?: string
): Promise<VideoEntry[]> => {
  try {
    const uploadPromises = videos.map(async (video) => {
      const videoId = generateVideoId();
      const videoPath = `videos/${userId}/${assetId ? `${assetId}/` : ''}${videoId}-${video.file.name}`;
      const thumbnailPath = `thumbnails/${userId}/${assetId ? `${assetId}/` : ''}${videoId}-thumbnail.jpg`;
      const { data: thumbnailUrl } = supabase.storage
        .from('thumbnails')
        .getPublicUrl('placeholder.jpg');
      const publicThumbnailUrl = thumbnailUrl.publicUrl;

      // Upload video
      const { error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoPath, video.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (videoError) {
        logger.error('Error uploading video:', videoError);
        throw new Error(`Video upload failed: ${videoError.message}`);
      }

      const metadata: VideoMetadata = {
        title: video.metadata.title,
        description: video.metadata.description,
        assetId: assetId,
        creatorName: video.metadata.creatorName,
        creator: video.metadata.creator,
        classification: video.metadata.classification || 'gen', // Provide default for required field
        isPrimary: video.metadata.isPrimary,
        loraName: video.metadata.loraName,
        loraDescription: video.metadata.loraDescription,
        loraType: video.metadata.loraType,
        loraLink: video.metadata.loraLink,
        model: video.metadata.model,
        modelVariant: video.metadata.modelVariant,
        baseModel: video.metadata.baseModel,
        placeholder_image: publicThumbnailUrl,
        trainingSteps: video.metadata.trainingSteps,
        resolution: video.metadata.resolution,
        trainingDataset: video.metadata.trainingDataset,
        aspectRatio: video.metadata.aspectRatio,
        associatedLoraIds: video.metadata.associatedLoraIds
      };

      // Create media entry
      const { data, error } = await supabase
        .from('media')
        .insert([
          {
            id: videoId,
            url: supabase.storage.from('videos').getPublicUrl(videoPath).data.publicUrl,
            title: video.metadata.title,
            description: video.metadata.description,
            creator: userId,
            user_id: userId,
            type: 'video',
            metadata: metadata,
            placeholder_image: publicThumbnailUrl,
            classification: video.metadata.classification || 'gen',
          }
        ])
        .select();

      if (error) {
        logger.error('Error creating media entry:', error);
        throw new Error(`Failed to create media entry: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned when creating media entry.");
      }

      return data[0] as VideoEntry;
    });

    return await Promise.all(uploadPromises);
  } catch (error: any) {
    logger.error('Error in uploadMultipleVideosToStorage:', error);
    throw new Error(`Failed to upload videos: ${error.message}`);
  }
};

// Function to upload multiple videos to Supabase and create media entries
export const uploadMultipleVideosToSupabase = async (
  videos: { file: File; metadata: VideoMetadata }[],
  userId: string,
  assetId?: string
): Promise<VideoEntry[]> => {
  try {
    const uploadPromises = videos.map(async (video) => {
      const videoId = generateVideoId();
      const videoPath = `videos/${userId}/${assetId ? `${assetId}/` : ''}${videoId}-${video.file.name}`;
      const thumbnailPath = `thumbnails/${userId}/${assetId ? `${assetId}/` : ''}${videoId}-thumbnail.jpg`;
      const { data: thumbnailUrl } = supabase.storage
        .from('thumbnails')
        .getPublicUrl('placeholder.jpg');
      const publicThumbnailUrl = thumbnailUrl.publicUrl;

      // Upload video
      const { error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoPath, video.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (videoError) {
        logger.error('Error uploading video:', videoError);
        throw new Error(`Video upload failed: ${videoError.message}`);
      }

      const metadata: VideoMetadata = {
        title: video.metadata.title,
        description: video.metadata.description,
        assetId: assetId,
        creatorName: video.metadata.creatorName,
        creator: video.metadata.creator,
        classification: video.metadata.classification || 'gen', // Provide default for required field
        isPrimary: video.metadata.isPrimary,
        loraName: video.metadata.loraName,
        loraDescription: video.metadata.loraDescription,
        loraType: video.metadata.loraType,
        loraLink: video.metadata.loraLink,
        model: video.metadata.model,
        modelVariant: video.metadata.modelVariant,
        baseModel: video.metadata.baseModel,
        placeholder_image: publicThumbnailUrl,
        trainingSteps: video.metadata.trainingSteps,
        resolution: video.metadata.resolution,
        trainingDataset: video.metadata.trainingDataset,
        aspectRatio: video.metadata.aspectRatio,
        associatedLoraIds: video.metadata.associatedLoraIds
      };

      // Create media entry
      const { data, error } = await supabase
        .from('media')
        .insert([
          {
            id: videoId,
            url: supabase.storage.from('videos').getPublicUrl(videoPath).data.publicUrl,
            title: video.metadata.title,
            description: video.metadata.description,
            creator: userId,
            user_id: userId,
            type: 'video',
            metadata: metadata,
            placeholder_image: publicThumbnailUrl,
            classification: video.metadata.classification || 'gen',
          }
        ])
        .select();

      if (error) {
        logger.error('Error creating media entry:', error);
        throw new Error(`Failed to create media entry: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned when creating media entry.");
      }

      return data[0] as VideoEntry;
    });

    return await Promise.all(uploadPromises);
  } catch (error: any) {
    logger.error('Error in uploadMultipleVideosToSupabase:', error);
    throw new Error(`Failed to upload videos: ${error.message}`);
  }
};
