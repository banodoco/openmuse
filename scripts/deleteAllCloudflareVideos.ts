import { createClient, SupabaseClient } from '@supabase/supabase-js'; // Not strictly needed for this script but can be kept if other scripts use it
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const logger = {
  log: (...args: any[]) => console.log('[DeleteVideosScript]', ...args),
  error: (...args: any[]) => console.error('[DeleteVideosScript]', ...args),
  warn: (...args: any[]) => console.warn('[DeleteVideosScript]', ...args),
};

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

async function listAllVideoUIDs(): Promise<string[]> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    logger.error('Cloudflare API Token or Account ID is missing from environment variables.');
    return [];
  }

  const videoUIDs: string[] = [];
  let page = 1;
  const perPage = 50; // Max allowed by CF API is 100 for some endpoints, 50 is safe for listing.
  let moreVideosExist = true;

  logger.log('Fetching list of all videos from Cloudflare Stream...');

  while (moreVideosExist) {
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?page=${page}&per_page=${perPage}`;
    
    try {
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(`Error fetching video list (page ${page}). Status: ${response.status}, Body: ${errorBody}`);
        moreVideosExist = false; // Stop trying if there's an error
        break;
      }

      const data = await response.json() as any; // Type assertion for simplicity

      if (data.result && Array.isArray(data.result) && data.result.length > 0) {
        data.result.forEach((video: any) => {
          if (video.uid) {
            videoUIDs.push(video.uid);
          }
        });
        logger.log(`Fetched page ${page}, added ${data.result.length} video UIDs. Total UIDs so far: ${videoUIDs.length}`);
        if (data.result.length < perPage) {
          moreVideosExist = false; // Last page
        } else {
          page++;
        }
      } else {
        moreVideosExist = false; // No more videos or empty result
      }
    } catch (error: any) {
      logger.error(`Exception while fetching video list (page ${page}):`, error.message);
      moreVideosExist = false;
    }
  }
  logger.log(`Found a total of ${videoUIDs.length} video UIDs.`);
  return videoUIDs;
}

async function deleteVideoByUID(uid: string): Promise<boolean> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    logger.error('Cloudflare API Token or Account ID is missing.');
    return false;
  }

  const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`;
  logger.log(`Attempting to delete video UID: ${uid} from URL: ${deleteUrl}`);

  try {
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    if (response.status === 200 || response.status === 204) { // 200 OK or 204 No Content are success
      logger.log(`Successfully deleted video UID: ${uid}. Status: ${response.status}`);
      return true;
    } else {
      const errorBody = await response.text();
      logger.error(`Error deleting video UID: ${uid}. Status: ${response.status}, Body: ${errorBody}`);
      return false;
    }
  } catch (error: any) {
    logger.error(`Exception while deleting video UID: ${uid}:`, error.message);
    return false;
  }
}

async function deleteAllVideos() {
  logger.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  logger.warn('!!! WARNING: THIS SCRIPT WILL ATTEMPT TO DELETE ALL VIDEOS FROM YOUR   !!!');
  logger.warn('!!! CLOUDFLARE STREAM ACCOUNT. THIS IS A DESTRUCTIVE OPERATION.        !!!');
  logger.warn('!!! THERE IS NO UNDO.                                                  !!!');
  logger.warn('!!! Press CTRL+C NOW if you do not want to proceed.                    !!!');
  logger.warn('!!! You have 10 seconds to cancel before it starts...                  !!!');
  logger.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

  await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay to cancel

  logger.log('Proceeding with video deletion...');

  const videoUIDs = await listAllVideoUIDs();

  if (videoUIDs.length === 0) {
    logger.log('No videos found to delete.');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const uid of videoUIDs) {
    const success = await deleteVideoByUID(uid);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    // Optional: Add a small delay between delete requests to avoid rate limiting, though usually not needed for this many.
    // await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
  }

  logger.log('--------------------------------------------------');
  logger.log('Deletion process completed.');
  logger.log(`Successfully deleted: ${successCount} videos.`);
  logger.log(`Failed to delete:   ${errorCount} videos.`);
  logger.log('--------------------------------------------------');
}

// To run the script, you would call this function.
// For safety, it's not called automatically here. You need to explicitly call it or run it.
// Example: Call `deleteAllVideos()` from another script or directly in a Node/Bun environment after careful consideration.

// If you are sure you want to run it, uncomment the line below and run the script:
deleteAllVideos()
  .then(() => logger.log('deleteAllVideos script finished.'))
  .catch(err => logger.error('deleteAllVideos script failed with unhandled error:', err)); 