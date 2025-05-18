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
  logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Starting Cloudflare Stream upload', { videoName: file.name, userId, assetId });

  if (!CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN) {
    logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN is not configured.');
    throw new Error('Cloudflare Stream customer subdomain is not configured.');
  }

  if (!SUPABASE_URL) {
      logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Imported SUPABASE_URL is not available.');
      throw new Error("Supabase project URL not configured for Edge Function endpoint (imported).");
  }
  
  const functionsBasePath = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1`;
  const edgeFunctionUrl = `${functionsBasePath}/get-cloudflare-video-upload-url`;
  
  logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Edge Function URL for creating TUS upload:', edgeFunctionUrl);

  let obtainedCloudflareUid = '';
  let actualCloudflareTusUrl = '';

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Error getting Supabase session or no session found.', sessionError);
      throw new Error('Supabase session not found. Cannot authorize Edge Function call.');
    }
    const supabaseAccessToken = session.access_token;

    const cfUploadMetadataHeader = createCloudflareUploadMetadataHeaderValue({
        name: videoMetadata.title || file.name,
    });

    // Step 1: Directly call the Edge Function to get the Cloudflare TUS URL
    logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Attempting direct POST to Edge Function.', { edgeFunctionUrl });
    const directFetchHeaders: Record<string, string> = {
      'Authorization': `Bearer ${supabaseAccessToken}`,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': file.size.toString(),
      // 'Content-Type': 'application/offset+octet-stream', // Not needed for creation POST which has no body
    };
    if (cfUploadMetadataHeader) {
      directFetchHeaders['Upload-Metadata'] = cfUploadMetadataHeader;
    }
    
    console.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Headers for direct POST to Edge Fn:', JSON.stringify(directFetchHeaders).replace(supabaseAccessToken, 'REDACTED_TOKEN'));


    const edgeFnResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: new Headers(directFetchHeaders), // Use Headers constructor
      body: null, // No body for the initial POST to Cloudflare via our Edge Function
    });

    logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Edge Function direct POST response status:', edgeFnResponse.status);
    
    if (!edgeFnResponse.ok || edgeFnResponse.status !== 201) { // Cloudflare returns 201 on success
      const errorBody = await edgeFnResponse.text();
      logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Error response from Edge Function direct POST.', {
        status: edgeFnResponse.status,
        statusText: edgeFnResponse.statusText,
        body: errorBody,
        headers: Object.fromEntries(edgeFnResponse.headers.entries())
      });
      throw new Error(`Failed to create TUS upload via Edge Function: ${edgeFnResponse.status} ${edgeFnResponse.statusText}. ${errorBody}`);
    }

    actualCloudflareTusUrl = edgeFnResponse.headers.get('Location') || '';
    obtainedCloudflareUid = edgeFnResponse.headers.get('Stream-Media-Id') || '';

    if (!actualCloudflareTusUrl) {
      logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] CRITICAL: Edge function response missing Location header.', { headers: Object.fromEntries(edgeFnResponse.headers.entries()) });
      throw new Error('Edge function did not return a TUS upload location.');
    }
    if (!obtainedCloudflareUid) {
      // Try to extract from Location if Stream-Media-Id is missing (fallback)
      const parts = actualCloudflareTusUrl.split('/');
      const potentialUid = parts[parts.length -1].split('?')[0];
      if (potentialUid && potentialUid.length > 20) { // Basic sanity check for a UID-like string
         obtainedCloudflareUid = potentialUid;
         logger.warn(`[VideoLoadSpeedIssue][CF-DirectFetch-v1] Stream-Media-Id missing, UID extracted from Location header: ${obtainedCloudflareUid}`);
      } else {
        logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] CRITICAL: Edge function response missing Stream-Media-Id and could not parse from Location.', { location: actualCloudflareTusUrl, headers: Object.fromEntries(edgeFnResponse.headers.entries()) });
        throw new Error('Edge function did not return Stream-Media-Id and it could not be parsed from Location.');
      }
    }
    
    logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Successfully obtained Cloudflare TUS URL and UID.', { actualCloudflareTusUrl, obtainedCloudflareUid });

    // Step 2: Use tus-js-client to upload the file to the obtained actualCloudflareTusUrl
    await new Promise<void>((resolve, reject) => {
      const tusClientMetadata: Record<string, string> = { // tus-js-client still uses metadata for its own purposes, even if not sent in initial POST
        filename: file.name,
        filetype: file.type,
      };
      if (videoMetadata.title) {
        tusClientMetadata.name = videoMetadata.title; // Corresponds to 'name' in Upload-Metadata
      }
      
      console.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Initializing tus.Upload with uploadUrl:', actualCloudflareTusUrl);

      const upload = new tus.Upload(file, {
        uploadUrl: actualCloudflareTusUrl, // Key change: Use uploadUrl
        endpoint: undefined, // Key change: Set endpoint to null/undefined as we're using uploadUrl
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: tusClientMetadata, 
        headers: {}, // Key change: No special headers needed for Cloudflare TUS PATCH requests
        onSuccess: () => {
          logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] TUS Upload to Cloudflare Direct URL Successful (onSuccess callback)', { videoName: file.name, obtainedCloudflareUid });
          // UID is already obtainedCloudflareUid
          resolve();
        },
        onError: (error) => {
          logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] TUS Upload to Cloudflare Direct URL Error:', error);
          let detailedErrorMessage = `TUS upload to ${actualCloudflareTusUrl} failed: ${error.message}`;
          const originalRequest = (error as tus.DetailedError).originalRequest;
          const originalResponse = (error as tus.DetailedError).originalResponse;
          if (originalRequest && originalResponse) {
            detailedErrorMessage += ` | Method: ${originalRequest.getMethod()}, URL: ${originalRequest.getURL()}, Status: ${originalResponse.getStatus()}, Body: ${originalResponse.getBody()}`;
          }
          logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] TUS Error Details:', {
             errorMessage: error.message,
             originalRequestMethod: originalRequest?.getMethod(),
             originalRequestUrl: originalRequest?.getURL(),
             originalResponseStatus: originalResponse?.getStatus(),
             originalResponseBody: originalResponse?.getBody(),
             isDetailedError: error instanceof tus.DetailedError
          });

          reject(new Error(detailedErrorMessage));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (onProgress) {
            onProgress(bytesUploaded, bytesTotal);
          }
        },
        // onAfterResponse is no longer needed to extract Location or Stream-Media-Id
        // as we get them from the initial direct fetch.
      });

      logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Starting TUS upload directly to Cloudflare URL.');
      upload.start();
    });

    const mediaId = generateMediaId();
    // Use the already obtained obtainedCloudflareUid
    const cfThumbnail = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${obtainedCloudflareUid}/thumbnails/thumbnail.jpg`;
    const cfHlsPlaybackUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${obtainedCloudflareUid}/manifest/video.m3u8`;
    const cfDashPlaybackUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${obtainedCloudflareUid}/manifest/video.mpd`;

    const fullMetadataForDb = {
      ...videoMetadata,
      cloudflareUid: obtainedCloudflareUid, 
    };

    const newMediaEntryPayload: any = { 
      id: mediaId,
      user_id: userId,
      title: videoMetadata.title || file.name,
      description: videoMetadata.description || '',
      type: 'video',
      url: cfHlsPlaybackUrl,
      cloudflare_stream_uid: obtainedCloudflareUid,
      cloudflare_thumbnail_url: cfThumbnail,
      cloudflare_playback_hls_url: cfHlsPlaybackUrl,
      cloudflare_playback_dash_url: cfDashPlaybackUrl,
      storage_provider: 'cloudflare-stream',
      metadata: fullMetadataForDb,
      placeholder_image: cfThumbnail,
      classification: videoMetadata.classification || 'gen',
      asset_id: assetId,
    };
    
    logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Attempting to insert new media entry post-TUS.', newMediaEntryPayload);
    const { data: insertedMedia, error: insertError } = await supabase
      .from('media')
      .insert(newMediaEntryPayload)
      .select()
      .single();

    if (insertError) {
      logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Error inserting media entry:', insertError);
      throw new Error(`Failed to create media entry: ${insertError.message}`);
    }
    if (!insertedMedia) {
        logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] No data returned after inserting media entry.');
        throw new Error('Failed to create media entry: no data returned.');
    }
    
    logger.log('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Successfully inserted media entry.', { mediaId: (insertedMedia as any).id, cloudflareUid: obtainedCloudflareUid });
    return insertedMedia as VideoEntry;

  } catch (error: any) {
    logger.error('[VideoLoadSpeedIssue][CF-DirectFetch-v1] Error in uploadVideoToCloudflareStream (outer try-catch):', { videoName: file.name, errorMessage: error.message, stack: error.stack });
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
