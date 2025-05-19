import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fetch from 'node-fetch'; // Using node-fetch for Node.js environment
import { Readable } from 'stream';
import * as dotenv from 'dotenv';
import { btoa } from 'buffer'; // For base64 encoding metadata

dotenv.config({ path: '.env.local' }); // Adjust path if your .env file is elsewhere
dotenv.config(); // Load from default .env as well

const logger = {
  log: (...args: any[]) => console.log('[MigrationScript]', ...args),
  error: (...args: any[]) => console.error('[MigrationScript]', ...args),
  warn: (...args: any[]) => console.warn('[MigrationScript]', ...args),
};

// --- Environment Variables ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
// Used to construct playback URLs if not fully provided by API, or for verification
const CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || 'customer-xt84pg68d7eakb9h'; 

interface MediaRecord {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  type: string;
  url: string | null; // Original URL (Supabase storage or external)
  storage_provider: string | null;
  cloudflare_stream_uid: string | null;
  metadata: any; // JSONB
  // Add other fields from your media table if needed for context/logging
}

// Helper to convert Blob to Buffer (common in Node.js for file operations)
async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Helper to create Cloudflare Upload-Metadata header value (from videoUploadService)
const createCloudflareUploadMetadataHeaderValue = (metadata: { name?: string }): string => {
  const parts: string[] = [];
  if (metadata.name) {
    // Ensure metadata.name is a UTF-8 string, then btoa
    const nameAsUTF8 = Buffer.from(metadata.name, 'utf-8').toString('utf-8'); // Ensure it's valid UTF-8
    parts.push(`name ${btoa(nameAsUTF8)}`);
  }
  // Add other metadata fields as needed (e.g., requiresSignedURLs, expiry)
  // For migration, 'name' is probably the most relevant for Cloudflare's system.
  return parts.join(',');
};


async function migrateVideos() {
  logger.log('Starting video migration to Cloudflare Stream...');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    logger.error('Missing required environment variables. Halting migration.');
    logger.error('Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_ACCOUNT_ID are set.');
    return;
  }

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch video records that need migration
  logger.log('Fetching videos for migration...');
  const { data: videosToMigrate, error: fetchError } = await supabase
    .from('media')
    .select('*')
    .eq('type', 'video')
    // .or('storage_provider.is.null,storage_provider.neq.cloudflare-stream,cloudflare_stream_uid.is.null'); // Criteria for needing migration
    .is('cloudflare_stream_uid', null); // More specific: only migrate if CF UID is not set

  if (fetchError) {
    logger.error('Error fetching videos from Supabase:', fetchError.message);
    return;
  }

  logger.log(`Found ${videosToMigrate.length} videos potentially requiring migration.`);

  // --- MODIFIED TO LOOP THROUGH ALL ELIGIBLE VIDEOS ---
  if (videosToMigrate.length === 0) {
    logger.log('No videos found requiring migration.');
    return;
  }

  logger.log(`Starting migration process for ${videosToMigrate.length} videos.`);

  for (const video of videosToMigrate as MediaRecord[]) {
    logger.log(`
    --- Processing video ID: ${video.id}, Title: ${video.title || 'N/A'} ---`);

    if (!video.url) {
      logger.warn(`Video ID: ${video.id} has no URL. Skipping.`);
      // logger.log(`--- Finished processing video ID: ${video.id} ---`); // Not finished, just skipped
      continue; // Skip to the next video
    }

    let videoFileBuffer: Buffer;
    let originalFileName = video.metadata?.original_filename || video.title || video.id;

    try {
      // 2. Download video file
      logger.log(`Downloading video: ${video.url}`);
      if (video.storage_provider === 'supabase' && SUPABASE_URL && video.url.includes(SUPABASE_URL)) {
        // Assuming URL is like: ${SUPABASE_URL}/storage/v1/object/public/videos/path/to/file.mp4
        // Need to extract the path for download
        const urlParts = video.url.split('/videos/'); // Adjust bucket name if different
        if (urlParts.length < 2) {
            logger.error(`Could not parse Supabase storage path from URL: ${video.url}`);
            // return;
            continue; // Skip to the next video
        }
        const videoPath = urlParts.slice(1).join('/videos/'); // Reconstruct path after bucket
        
        const { data: blob, error: downloadError } = await supabase.storage
          .from('videos') // Ensure this is your video bucket name
          .download(videoPath);

        if (downloadError) {
          logger.error(`Error downloading video ${video.id} from Supabase Storage (${videoPath}):`, downloadError.message);
          // return;
          continue; // Skip to the next video
        }
        if (!blob) {
            logger.error(`No blob data returned for video ${video.id} from Supabase Storage (${videoPath}).`);
            // return;
            continue; // Skip to the next video
        }
        videoFileBuffer = await blobToBuffer(blob);
        originalFileName = videoPath.split('/').pop() || originalFileName;

      } else { // External URL
        const response = await fetch(video.url);
        if (!response.ok) {
          logger.error(`Error fetching video ${video.id} from external URL ${video.url}. Status: ${response.status}`);
          // return;
          continue; // Skip to the next video
        }
        const arrayBuffer = await response.arrayBuffer();
        videoFileBuffer = Buffer.from(arrayBuffer);
        try {
            const disposition = response.headers.get('content-disposition');
            if (disposition) {
                const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
                if (filenameMatch && filenameMatch[1]) {
                    originalFileName = filenameMatch[1];
                }
            }
            if (originalFileName === video.id && video.url) { // try to get from path
                 originalFileName = new URL(video.url).pathname.split('/').pop() || originalFileName;
            }
        } catch (e) {
            logger.warn(`Could not extract filename from Content-Disposition or URL for ${video.url}`);
        }
      }
      logger.log(`Downloaded video ${video.id} (${originalFileName}), size: ${(videoFileBuffer.length / (1024*1024)).toFixed(2)} MB`);

      // --- MODIFIED UPLOAD LOGIC TO USE TUS FLOW ---

      // Step 1: Initiate TUS upload and get the upload URL from Cloudflare
      const initialCfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`;
      const fileSize = videoFileBuffer.length;
      const base64FileName = btoa(unescape(encodeURIComponent(originalFileName))); // Re-using the helper logic

      const initiationHeaders: Record<string, string> = {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': fileSize.toString(),
        'Upload-Metadata': `name ${base64FileName}`,
      };
      if (video.user_id) {
        initiationHeaders['Upload-Creator'] = video.user_id;
      }

      logger.log(`Initiating TUS upload for ${originalFileName} to Cloudflare... Headers:`, JSON.stringify(initiationHeaders).substring(0,500) + '...');
      
      let tusUploadUrl = '';
      let cloudflareStreamUid = '';

      try {
        const initiationResponse = await fetch(initialCfApiUrl, {
          method: 'POST',
          headers: initiationHeaders,
          body: null, // No body for this initial request
        });

        const initiationResponseHeaders = initiationResponse.headers;
        logger.log(`TUS Initiation Response Status: ${initiationResponse.status}`);
        // Log all headers from initiation response for debugging
        const allRespHeaders: Record<string, string> = {};
        initiationResponseHeaders.forEach((val, key) => { allRespHeaders[key] = val; });
        logger.log('TUS Initiation Response Headers:', JSON.stringify(allRespHeaders));

        if (initiationResponse.status !== 201) {
          const errorBodyText = await initiationResponse.text();
          logger.error(`Error initiating TUS upload for ${originalFileName}. Status: ${initiationResponse.status}, Body: ${errorBodyText}`);
          // return; // Skip this video, or use 'continue' if in a loop for multiple videos
          continue; // Skip to the next video
        }

        tusUploadUrl = initiationResponseHeaders.get('location') || '';
        cloudflareStreamUid = initiationResponseHeaders.get('stream-media-id') || '';

        if (!tusUploadUrl || !cloudflareStreamUid) {
          logger.error(`TUS initiation for ${originalFileName} did not return a valid Location or Stream-Media-Id header.`);
          logger.error(`Location: ${tusUploadUrl}, Stream-Media-Id: ${cloudflareStreamUid}`);
          // return; // Skip this video
          continue; // Skip to the next video
        }

        logger.log(`Successfully initiated TUS upload. URL: ${tusUploadUrl}, UID: ${cloudflareStreamUid}`);

      } catch (initError: any) {
        logger.error(`Exception during TUS initiation for ${originalFileName}:`, initError.message, initError.stack);
        // return; // Skip this video
        continue; // Skip to the next video
      }

      // Step 2: Upload the file in chunks using TUS PATCH requests
      logger.log(`Starting TUS PATCH uploads for ${originalFileName} to ${tusUploadUrl}`);
      let currentOffset = 0;
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks (adjust as needed)
      let patchErrorOccurred = false;

      while (currentOffset < fileSize) {
        const chunk = videoFileBuffer.slice(currentOffset, currentOffset + chunkSize);
        const patchHeaders: Record<string, string> = {
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': currentOffset.toString(),
          'Content-Type': 'application/offset+octet-stream',
          'Content-Length': chunk.length.toString(),
        };

        logger.log(`TUS PATCH: Uploading chunk for ${originalFileName}. Offset: ${currentOffset}, Chunk Size: ${chunk.length}`);

        try {
          const patchResponse = await fetch(tusUploadUrl, {
            method: 'PATCH',
            headers: patchHeaders,
            body: chunk,
          });

          logger.log(`TUS PATCH Response Status for offset ${currentOffset}: ${patchResponse.status}`);
          const patchResponseUploadOffset = patchResponse.headers.get('upload-offset');
          logger.log(`TUS PATCH Response Headers for offset ${currentOffset}: Upload-Offset: ${patchResponseUploadOffset}`);

          if (patchResponse.status !== 204) {
            const errorBodyText = await patchResponse.text();
            logger.error(`Error during TUS PATCH for ${originalFileName} at offset ${currentOffset}. Status: ${patchResponse.status}, Body: ${errorBodyText}`);
            // return; // Abort this video's migration
            patchErrorOccurred = true; // Set flag and break from TUS loop
            break;
          }

          const returnedUploadOffset = patchResponse.headers.get('upload-offset');

          if (returnedUploadOffset) {
            currentOffset = parseInt(returnedUploadOffset, 10);
          } else {
            // This case should ideally not happen with Cloudflare TUS if the status is 204.
            // If it does, it implies the server accepted the chunk but didn't report the new total offset.
            // For robustness, we could assume the chunk was accepted and advance by chunk length,
            // but it's better to log a warning as this indicates unexpected server behavior.
            logger.warn(`TUS PATCH for ${originalFileName} at offset ${currentOffset} returned 204 but no Upload-Offset header. Assuming chunk accepted and advancing offset by chunk size as a fallback.`);
            currentOffset += chunk.length; 
          }
          logger.log(`TUS PATCH successful for previous chunk. New currentOffset for next potential chunk (or completion if >= fileSize): ${currentOffset}`);

        } catch (patchError: any) {
          logger.error(`Exception during TUS PATCH for ${originalFileName} at offset ${currentOffset}:`, patchError.message, patchError.stack);
          // return; // Abort this video's migration
          patchErrorOccurred = true; // Set flag and break from TUS loop
          break;
        }
      }

      // If a PATCH error occurred, skip to the next video
      if (patchErrorOccurred) {
        logger.error(`Skipping database update for ${originalFileName} due to TUS PATCH error.`);
        continue;
      }

      if (currentOffset < fileSize) {
        logger.error(`TUS upload for ${originalFileName} completed PATCH loop but offset ${currentOffset} is less than file size ${fileSize}. Marking as failed.`);
        // return; // Upload did not complete fully
        continue; // Skip to the next video
      }

      logger.log(`Successfully uploaded video ${originalFileName} to Cloudflare via TUS. UID: ${cloudflareStreamUid}`);

      // 4. Update Supabase record (using cloudflareStreamUid from Step 1)
      const playbackHls = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareStreamUid}/manifest/video.m3u8`;
      const playbackDash = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareStreamUid}/manifest/video.mpd`;
      const thumbnailUrl = `https://${CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com/${cloudflareStreamUid}/thumbnails/thumbnail.jpg`;

      const updatedMetadata = {
        ...(video.metadata || {}),
        cloudflareUid: cloudflareStreamUid,
        original_cloudflare_response: { tusUploadUrl, cloudflareStreamUid }, // Optional: store the full CF response for audit
        migrated_at: new Date().toISOString(),
      };
      
      // Remove old Supabase storage path if it exists in metadata
      if (updatedMetadata.supabase_storage_path) {
        delete updatedMetadata.supabase_storage_path;
      }


      const { error: updateError } = await supabase
        .from('media')
        .update({
          storage_provider: 'cloudflare-stream',
          cloudflare_stream_uid: cloudflareStreamUid,
          cloudflare_thumbnail_url: thumbnailUrl,
          cloudflare_playback_hls_url: playbackHls,
          cloudflare_playback_dash_url: playbackDash,
          url: playbackHls, // Update primary URL to HLS
          placeholder_image: thumbnailUrl, // Ensure placeholder_image is updated
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', video.id);

      if (updateError) {
        logger.error(`Error updating Supabase record for video ${video.id} (CF UID: ${cloudflareStreamUid}):`, updateError.message);
        // Consider how to handle this: maybe store successful CF uploads to retry DB update later
      } else {
        logger.log(`Successfully updated Supabase record for video ${video.id}.`);
      }

    } catch (err: any) {
      logger.error(`Unhandled error processing video ${video.id}:`, err.message, err.stack);
    }
    logger.log(`--- Finished processing video ID: ${video.id} ---`);

    // Log the ID of the processed video as requested
    logger.log(`[Confirmation] Row ID processed in this run: ${video.id}`);
  }

  logger.log('Video migration process completed for all eligible videos.');
}

// Run the migration
migrateVideos()
  .then(() => logger.log('Migration script finished execution.'))
  .catch(err => logger.error('Migration script failed with unhandled error:', err)); 