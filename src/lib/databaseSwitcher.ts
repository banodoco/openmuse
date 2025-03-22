
import { supabaseDB } from './supabaseDB';
import { getCurrentUser } from './auth';

// A database provider that always returns Supabase database
class DatabaseSwitcher {
  async getDatabase() {
    try {
      console.log("DatabaseSwitcher: Getting current user");
      // Get the current user
      const user = await getCurrentUser();
      
      // Set the user ID in the database instance if available
      if (user) {
        console.log(`DatabaseSwitcher: User authenticated, ID: ${user.id}`);
        supabaseDB.setCurrentUserId(user.id);
      } else {
        console.log('DatabaseSwitcher: Not authenticated, using anonymous access');
        supabaseDB.setCurrentUserId(null);
      }
    } catch (error) {
      console.error('DatabaseSwitcher: Error getting current user:', error);
      supabaseDB.setCurrentUserId(null);
    }
    
    return supabaseDB;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
