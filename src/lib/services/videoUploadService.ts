import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { VideoMetadata, VideoEntry } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@/lib/logger';
import * as tus from 'tus-js-client';

const logger = new Logger('videoUploadService');

const CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN = 'customer-xt84pg68d7eakb9h';
// const ORIGINAL_PLACEHOLDER_SUBDOMAIN = 'YOUR_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN'; // No longer needed for comparison

// Function to generate a unique ID for our media database entries
const generateMediaId = (): string => {
  return uuidv4();
};

// Helper to create Upload-Metadata string for TUS
// See: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/#upload-metadata-header-syntax
const createCloudflareUploadMetadataHeaderValue = (metadata: { 
  name?: string, 
  requiresSignedURLs?: boolean, 
  expiry?: string /* ISO 8601 */, 
  maxDurationSeconds?: number 
}): string => {
  const parts: string[] = [];
  if (metadata.name) parts.push(`name ${btoa(unescape(encodeURIComponent(metadata.name)))}`);
  if (metadata.requiresSignedURLs) parts.push(`requiresignedurls`);
  if (metadata.expiry) parts.push(`expiry ${btoa(unescape(encodeURIComponent(metadata.expiry)))}`);
  if (metadata.maxDurationSeconds) parts.push(`maxDurationSeconds ${btoa(unescape(encodeURIComponent(String(metadata.maxDurationSeconds))))}`);
  return parts.join(',');
};

// --- New Primary Function for Cloudflare Stream Video Upload ---
export const uploadVideoToCloudflareStream = async (
  file: File,
  userId: string,
  videoMetadata: VideoMetadata,
  assetId?: string,
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void
): Promise<VideoEntry> => {
  logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Starting Cloudflare Stream TUS upload', { videoName: file.name, userId, assetId });

  if (!CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN) {
    logger.error('[VideoLoadSpeedIssue][CF-TUSv4] CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN is not configured.');
    throw new Error('Cloudflare Stream customer subdomain is not configured.');
  }

  if (!SUPABASE_URL) {
      logger.error('[VideoLoadSpeedIssue][CF-TUSv4] Imported SUPABASE_URL is not available.');
      throw new Error("Supabase project URL not configured for Edge Function endpoint (imported).");
  }
  
  const functionsBasePath = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1`;
  const tusClientEndpoint = `${functionsBasePath}/get-cloudflare-video-upload-url`;
  
  logger.log('[VideoLoadSpeedIssue][CF-TUSv4] TUS client endpoint set to Edge Function:', tusClientEndpoint);

  let cloudflareUid = '';

  try {
    // Get Supabase session token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      logger.error('[VideoLoadSpeedIssue][CF-TUSv4] Error getting Supabase session or no session found.', sessionError);
      throw new Error('Supabase session not found. Cannot authorize Edge Function call.');
    }
    const supabaseAccessToken = session.access_token;

    await new Promise<void>((resolve, reject) => {
      const tusClientMetadata: Record<string, string> = {
        filename: file.name,
        filetype: file.type,
      };
      if (videoMetadata.title) {
        tusClientMetadata.name = videoMetadata.title;
      }

      const cfUploadMetadataHeader = createCloudflareUploadMetadataHeaderValue({
          name: videoMetadata.title || file.name,
      });

      const upload = new tus.Upload(file, {
        endpoint: tusClientEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: tusClientMetadata,
        headers: ((req: tus.HttpRequest) => {
          const currentRequestUrl = req.getURL();
          const dynamicHeaders: Record<string, string> = {};

          logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Headers function invoked.', {
            currentRequestUrl,
            tusClientEndpoint,
            method: req.getMethod(),
            hasSupabaseToken: !!supabaseAccessToken,
            cfUploadMetadataHeaderProvided: !!cfUploadMetadataHeader
          });

          // Only add Supabase Auth and Cloudflare Upload-Metadata for the initial POST to our Edge Function
          if (currentRequestUrl === tusClientEndpoint) {
            logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Condition met: currentRequestUrl === tusClientEndpoint. Preparing headers for Edge Function.');
            dynamicHeaders['Authorization'] = `Bearer ${supabaseAccessToken}`;
            if (cfUploadMetadataHeader) {
              dynamicHeaders['Upload-Metadata'] = cfUploadMetadataHeader;
            }
            logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Adding Auth & Upload-Metadata for Edge Fn request', { url: currentRequestUrl, preparedHeaders: dynamicHeaders });
          } else {
            logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Condition NOT met: currentRequestUrl !== tusClientEndpoint. Not adding special headers for direct CF TUS request.', { url: currentRequestUrl, tusClientEndpoint });
            // For direct TUS uploads to Cloudflare, do not send these headers.
            // Cloudflare does not expect/allow Authorization on its TUS endpoint.
            // Upload-Metadata is only for the initial API call handled by our Edge Function.
            logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Not adding Auth/Upload-Metadata for direct CF TUS request', { url: currentRequestUrl });
          }
          return dynamicHeaders;
        }) as any,
        onSuccess: () => {
          logger.log('[VideoLoadSpeedIssue][CF-TUSv4] TUS Upload Successful (onSuccess callback)', { videoName: file.name });
          if (!cloudflareUid) {
            const finalUploadUrl = upload.url; 
            if (finalUploadUrl) {
              const parts = finalUploadUrl.split('/');
              const potentialUid = parts[parts.length -1].split('?')[0]; 
              if (potentialUid && potentialUid.length > 20) { 
                 cloudflareUid = potentialUid;
                 logger.warn(`[VideoLoadSpeedIssue][CF-TUSv4] UID extracted from final TUS URL (Location header): ${cloudflareUid}. Prefer Stream-Media-Id.`);
              }
            }
            if (!cloudflareUid) {
                logger.error("[VideoLoadSpeedIssue][CF-TUSv4] Cloudflare UID could not be determined after upload (onSuccess).");
                reject(new Error("Cloudflare UID could not be determined after upload."));
                return;
            }
          }
          logger.log('[VideoLoadSpeedIssue][CF-TUSv4] UID confirmed for DB save (onSuccess): ', cloudflareUid);
          resolve();
        },
        onError: (error) => {
          logger.error('[VideoLoadSpeedIssue][CF-TUSv4] TUS Upload Error:', error);
          reject(new Error(`TUS upload failed: ${error.message}`));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (onProgress) {
            onProgress(bytesUploaded, bytesTotal);
          }
        },
        onAfterResponse: (req, res) => {
            const mediaIdHeader = res.getHeader('Stream-Media-Id');
            if (mediaIdHeader) {
                cloudflareUid = mediaIdHeader;
                logger.log(`[VideoLoadSpeedIssue][CF-TUSv4] Stream-Media-Id (UID) from Edge Function response: ${cloudflareUid}`);
            }
            const locationHeader = res.getHeader('Location');
            if(locationHeader){
                logger.log(`[VideoLoadSpeedIssue][CF-TUSv4] Actual Cloudflare TUS endpoint (Location) from Edge Function: ${locationHeader}`);
            }
            if (req.getMethod() === 'POST' && !mediaIdHeader && !locationHeader){
                logger.warn('[VideoLoadSpeedIssue][CF-TUSv4] POST to Edge Fn: Missing Stream-Media-Id or Location in response headers from Edge Fn.');
            }
        }
      });

      logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Starting TUS upload to Edge Function proxy.');
      upload.start();
    });

    const mediaId = generateMediaId();
    const cfThumbnail = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareUid}/thumbnails/thumbnail.jpg`;
    const cfHlsPlaybackUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareUid}/manifest/video.m3u8`;
    const cfDashPlaybackUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareUid}/manifest/video.mpd`;

    const fullMetadataForDb = {
      ...videoMetadata,
      cloudflareUid: cloudflareUid, 
    };

    const newMediaEntryPayload: any = { 
      id: mediaId,
      user_id: userId,
      title: videoMetadata.title || file.name,
      description: videoMetadata.description || '',
      type: 'video',
      url: cfHlsPlaybackUrl,
      cloudflare_stream_uid: cloudflareUid,
      cloudflare_thumbnail_url: cfThumbnail,
      cloudflare_playback_hls_url: cfHlsPlaybackUrl,
      cloudflare_playback_dash_url: cfDashPlaybackUrl,
      storage_provider: 'cloudflare-stream',
      metadata: fullMetadataForDb,
      placeholder_image: cfThumbnail,
      classification: videoMetadata.classification || 'gen',
      asset_id: assetId,
    };
    
    logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Attempting to insert new media entry post-TUS.', newMediaEntryPayload);
    const { data: insertedMedia, error: insertError } = await supabase
      .from('media')
      .insert(newMediaEntryPayload)
      .select()
      .single();

    if (insertError) {
      logger.error('[VideoLoadSpeedIssue][CF-TUSv4] Error inserting media entry:', insertError);
      throw new Error(`Failed to create media entry: ${insertError.message}`);
    }
    if (!insertedMedia) {
        logger.error('[VideoLoadSpeedIssue][CF-TUSv4] No data returned after inserting media entry.');
        throw new Error('Failed to create media entry: no data returned.');
    }
    
    logger.log('[VideoLoadSpeedIssue][CF-TUSv4] Successfully inserted media entry.', { mediaId: (insertedMedia as any).id, cloudflareUid });
    return insertedMedia as VideoEntry;

  } catch (error: any) {
    logger.error('[VideoLoadSpeedIssue][CF-TUSv4] Error in uploadVideoToCloudflareStream:', { videoName: file.name, errorMessage: error.message, stack: error.stack });
    throw error; 
  }
};

// Type for results of multiple uploads, can be a success or an error object
type UploadOperationResult = 
  | { status: 'success'; entry: VideoEntry; title: string; }
  | { status: 'error'; error: string; title: string; };

// --- Function to upload multiple videos to Cloudflare Stream ---
export const uploadMultipleVideosToCloudflare = async (
  videos: { file: File; metadata: VideoMetadata }[],
  userId: string,
  assetId?: string,
  onProgress?: (videoName: string, bytesUploaded: number, bytesTotal: number, videoIndex: number, totalVideos: number) => void
): Promise<UploadOperationResult[]> => {
  logger.log('[VideoLoadSpeedIssue][CF-TUSv3] Starting multiple video uploads to Cloudflare Stream (via TUS proxy).', { count: videos.length, userId, assetId });
  const results: UploadOperationResult[] = [];
  let completedCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const videoItem = videos[i];
    const videoTitle = videoItem.metadata.title || videoItem.file.name;
    try {
      logger.log(`[VideoLoadSpeedIssue][CF-TUSv3] Uploading video ${i + 1} of ${videos.length}: ${videoTitle}`);
      const resultEntry = await uploadVideoToCloudflareStream(
        videoItem.file,
        userId,
        videoItem.metadata,
        assetId,
        (bytesUploaded, bytesTotal) => {
          if (onProgress) {
            onProgress(videoTitle, bytesUploaded, bytesTotal, i, videos.length);
          }
        }
      );
      results.push({ status: 'success', entry: resultEntry, title: videoTitle });
      completedCount++;
      logger.log(`[VideoLoadSpeedIssue][CF-TUSv3] Successfully uploaded video ${i + 1} of ${videos.length}: ${videoTitle}`);
    } catch (error: any) {
      logger.error(`[VideoLoadSpeedIssue][CF-TUSv3] Error uploading video ${videoTitle} (${i + 1} of ${videos.length}):`, error.message);
      results.push({ status: 'error', error: error.message, title: videoTitle });
    }
  }
  logger.log(`[VideoLoadSpeedIssue][CF-TUSv3] Multiple video TUS upload process completed. ${completedCount}/${videos.length} succeeded.`);
  return results;
};


// --- DEPRECATED / ADAPTED FUNCTIONS ---

export const uploadVideoToStorage = async (
  _video: File, // Mark as unused
  _userId: string,
  _assetId?: string
): Promise<{ videoPath: string; thumbnailPath: string }> => {
  logger.warn('[VideoLoadSpeedIssue] uploadVideoToStorage is deprecated and should not be called for new uploads.');
  throw new Error("uploadVideoToStorage is deprecated. New video uploads should use Cloudflare Stream via TUS.");
};

export const createMediaFromVideo = async (
  cloudflareStreamUid: string,
  videoMetadata: VideoMetadata,
  userId: string,
  assetId?: string
): Promise<VideoEntry> => {
  logger.warn('[VideoLoadSpeedIssue][CF-TUSv3] createMediaFromVideo for CF. Review if still needed or if TUS flow covers all direct CF UID cases.');
  if (!CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN) {
     logger.error('[VideoLoadSpeedIssue][CF-TUSv3] CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN is not configured.');
     throw new Error('Cloudflare Stream customer subdomain not configured.');
  }

  const mediaId = generateMediaId();
  const cfThumbnail = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareStreamUid}/thumbnails/thumbnail.jpg`;
  const cfHlsPlaybackUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareStreamUid}/manifest/video.m3u8`;
  const cfDashPlaybackUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareStreamUid}/manifest/video.mpd`;

  const fullMetadataForDb = {
    ...videoMetadata,
    cloudflareUid: cloudflareStreamUid,
  };

  const newMediaEntryPayload: any = { 
    id: mediaId,
    user_id: userId,
    title: videoMetadata.title,
    description: videoMetadata.description || '',
    type: 'video',
    url: cfHlsPlaybackUrl,
    cloudflare_stream_uid: cloudflareStreamUid,
    cloudflare_thumbnail_url: cfThumbnail,
    cloudflare_playback_hls_url: cfHlsPlaybackUrl,
    cloudflare_playback_dash_url: cfDashPlaybackUrl,
    storage_provider: 'cloudflare-stream',
    metadata: fullMetadataForDb,
    placeholder_image: cfThumbnail,
    classification: videoMetadata.classification || 'gen',
    asset_id: assetId,
  };

  try {
    const { data, error } = await supabase
      .from('media')
      .insert(newMediaEntryPayload)
      .select()
      .single();

    if (error) {
      logger.error('[VideoLoadSpeedIssue][CF-TUSv3] Error creating media entry (from existing CF UID):', error);
      throw new Error(`Failed to create media entry: ${error.message}`);
    }
    if (!data) {
      throw new Error("No data returned when creating media entry (from existing CF UID).");
    }
    logger.log('[VideoLoadSpeedIssue][CF-TUSv3] Media entry created from existing CF UID', { mediaId: (data as any).id, cloudflareStreamUid });
    return data as VideoEntry;
  } catch (error: any) {
    logger.error('[VideoLoadSpeedIssue][CF-TUSv3] Error in createMediaFromVideo (for CF):', error);
    throw new Error(`Failed to create media entry: ${error.message}`);
  }
};

export const createMediaFromExistingVideo = async (
  videoMetadata: VideoMetadata,
  userId: string,
  videoUrl: string, // This could be a CF manifest URL or watch URL
  assetId?: string,
  knownCloudflareStreamUid?: string // Allow passing UID if already known
): Promise<VideoEntry | null> => {
  logger.warn('[VideoLoadSpeedIssue][CF-TUSv3] createMediaFromExistingVideo for CF. Review if needed.');
  if (!videoUrl) {
    logger.error('[VideoLoadSpeedIssue] Video URL is required for createMediaFromExistingVideo.');
    return null;
  }
  
  let cfUid = knownCloudflareStreamUid;
  let cfThumbnail = videoMetadata.placeholder_image;
  let cfHlsUrl = '';
  let cfDashUrl = '';
  let storageProvider: any = 'other'; // Changed from VideoEntry['storage_provider'] to any temporarily

  if (!CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN) { // Simplified check
    logger.error('[VideoLoadSpeedIssue] CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN not configured. Cannot derive Cloudflare info for existing video.');
  } else {
    const streamUrlPattern = new RegExp(`https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}\.cloudflarestream\.com/([a-f0-9]+)/`);
    const match = videoUrl.match(streamUrlPattern);
    if (match && match[1]) {
      cfUid = match[1]; 
    }
  }
  
  if (cfUid && CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN) { // Simplified check
    storageProvider = 'cloudflare-stream';
    if (!cfThumbnail) cfThumbnail = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cfUid}/thumbnails/thumbnail.jpg`;
    cfHlsUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cfUid}/manifest/video.m3u8`;
    cfDashUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cfUid}/manifest/video.mpd`;
  } else {
      // Fallback for non-Cloudflare URLs or if subdomain isn't properly set up for parsing
      if (videoUrl.endsWith('.m3u8')) cfHlsUrl = videoUrl;
      if (videoUrl.endsWith('.mpd')) cfDashUrl = videoUrl;
  }


  const mediaId = generateMediaId();
  const fullMetadataForDb = {
    ...videoMetadata,
    ...(cfUid && { cloudflareUid: cfUid }),
  };

  const newMediaEntryPayload: any = { 
    id: mediaId,
    user_id: userId,
    title: videoMetadata.title,
    description: videoMetadata.description || '',
    type: 'video',
    url: cfHlsUrl || videoUrl, // Prioritize HLS, fallback to original if no HLS
    metadata: fullMetadataForDb,
    placeholder_image: cfThumbnail || videoMetadata.placeholder_image, 
    classification: videoMetadata.classification || 'gen',
    asset_id: assetId,
    storage_provider: storageProvider,
    ...(cfUid && { cloudflare_stream_uid: cfUid }),
    ...(cfThumbnail && { cloudflare_thumbnail_url: cfThumbnail }), // Only add if we have a value
    ...(cfHlsUrl && { cloudflare_playback_hls_url: cfHlsUrl }),
    ...(cfDashUrl && { cloudflare_playback_dash_url: cfDashUrl }),
  };

  try {
    const { data, error } = await supabase
      .from('media')
      .insert(newMediaEntryPayload)
      .select()
      .single();

    if (error) {
      logger.error('[VideoLoadSpeedIssue][CF-TUSv3] Error creating media entry from existing video (adapted):', error);
      throw new Error(`Failed to create media entry from existing video: ${error.message}`);
    }
    if (!data) {
      throw new Error("No data returned when creating media entry from existing video (adapted).");
    }
    logger.log('[VideoLoadSpeedIssue][CF-TUSv3] Media entry created from existing video URL (adapted)', { mediaId: (data as any).id, videoUrl, cfUid });
    return data as VideoEntry;
  } catch (error: any) {
    logger.error('[VideoLoadSpeedIssue][CF-TUSv3] Error in createMediaFromExistingVideo (adapted):', error);
    throw new Error(`Failed to create media entry from existing video: ${error.message}`);
  }
};

// --- Simplified alias for multiple uploads ---
// The old `uploadMultipleVideosToSupabase` and `uploadMultipleVideosToStorage` are now effectively replaced by `uploadMultipleVideosToCloudflare`
// If you need to maintain the old export name for compatibility:
export const uploadMultipleVideosToSupabase = async (
  videos: { file: File; metadata: VideoMetadata }[],
  userId: string,
  assetId?: string,
  onProgress?: (videoName: string, bytesUploaded: number, bytesTotal: number, videoIndex: number, totalVideos: number) => void
): Promise<UploadOperationResult[]> => {
  logger.warn('[VideoLoadSpeedIssue][CF-TUSv3] uploadMultipleVideosToSupabase is an alias for uploadMultipleVideosToCloudflare.');
  return uploadMultipleVideosToCloudflare(videos, userId, assetId, onProgress);
};

// Removing the old, duplicated Supabase-direct upload logic for uploadMultipleVideosToSupabase
// as it's now superseded by the Cloudflare implementation.

// Ensure all other functions like `uploadMultipleVideosToStorage` if it was distinct and not an alias before,
// are either removed or clearly point to the new Cloudflare-based functions if they are to be kept as exports.
// The provided snippet had `uploadMultipleVideosToStorage` calling `uploadVideoToCloudflareStream`,
// so I've renamed it to `uploadMultipleVideosToCloudflare` for clarity.
// If `uploadMultipleVideosToStorage` must remain as an export, it can also alias `uploadMultipleVideosToCloudflare`.

/*
  The old content had multiple definitions of `uploadMultipleVideosToSupabase`
  with Supabase direct storage logic. These have been removed.
  Only one `uploadMultipleVideosToSupabase` is kept, aliasing the new Cloudflare method.
*/
