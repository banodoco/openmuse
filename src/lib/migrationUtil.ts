
import { supabase } from './supabase';
import { databaseSwitcher } from './databaseSwitcher';
import { Logger } from './logger';

const logger = new Logger('MigrationUtil');

export const migrateExistingVideos = async (): Promise<void> => {
  try {
    // First check if the database is connected
    const db = await databaseSwitcher.getDatabase();
    if (!db) {
      logger.error('No database available for migration');
      return;
    }

    // Get all videos from Supabase
    const { data: videos, error } = await supabase
      .from('video_entries')
      .select('*');

    if (error) {
      logger.error('Error fetching videos for migration:', error);
      return;
    }

    if (!videos || videos.length === 0) {
      logger.log('No videos to migrate');
      return;
    }

    logger.log(`Found ${videos.length} videos to potentially migrate`);

    // Count how many need migration
    let migrationCount = 0;

    // Process each video
    for (const video of videos) {
      // Check if video needs migration (doesn't have metadata)
      if (!video.metadata) {
        // Create basic metadata from existing fields
        const basicMetadata = {
          title: `Video from ${video.reviewer_name}`,
          description: '',
          creator: 'self' as const,
          classification: 'art' as const
        };

        // Update the video with the new metadata
        const { error: updateError } = await supabase
          .from('video_entries')
          .update({ metadata: basicMetadata })
          .eq('id', video.id);

        if (updateError) {
          logger.error(`Error migrating video ${video.id}:`, updateError);
        } else {
          migrationCount++;
          logger.log(`Migrated video ${video.id}`);
        }
      }
    }

    logger.log(`Migration complete. Migrated ${migrationCount} videos.`);
  } catch (error) {
    logger.error('Unexpected error during migration:', error);
  }
};
