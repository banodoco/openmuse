
import { videoDB } from './db';
import { videoStorage } from './storage';

export async function migrateExistingVideos(): Promise<void> {
  const entries = videoDB.getAllEntries();
  let migratedCount = 0;

  console.log(`Found ${entries.length} entries to check for migration`);

  for (const entry of entries) {
    let updated = false;

    // Check if original video is a data URL and needs migration
    if (entry.video_location && entry.video_location.startsWith('data:')) {
      try {
        // Convert data URL to blob
        const response = await fetch(entry.video_location);
        const blob = await response.blob();
        
        // Save to IndexedDB
        await videoStorage.saveVideo({
          id: `video_${entry.id}`,
          blob
        });
        
        // Update entry with new location
        entry.video_location = `idb://video_${entry.id}`;
        updated = true;
        console.log(`Migrated original video for entry ${entry.id}`);
      } catch (error) {
        console.error(`Failed to migrate original video for entry ${entry.id}:`, error);
      }
    }

    // Check if acting video is a data URL and needs migration
    if (entry.acting_video_location && entry.acting_video_location.startsWith('data:')) {
      try {
        // Convert data URL to blob
        const response = await fetch(entry.acting_video_location);
        const blob = await response.blob();
        
        // Save to IndexedDB
        await videoStorage.saveVideo({
          id: `acting_${entry.id}`,
          blob
        });
        
        // Update entry with new location
        entry.acting_video_location = `idb://acting_${entry.id}`;
        updated = true;
        console.log(`Migrated acting video for entry ${entry.id}`);
      } catch (error) {
        console.error(`Failed to migrate acting video for entry ${entry.id}:`, error);
      }
    }

    if (updated) {
      videoDB.updateEntry(entry.id, entry);
      migratedCount++;
    }
  }

  console.log(`Migration completed. Migrated ${migratedCount} entries.`);
}
