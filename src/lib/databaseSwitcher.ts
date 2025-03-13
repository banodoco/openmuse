
import { supabaseDB } from './supabaseDB';
import { getCurrentUser } from './auth';

// A database provider that always returns Supabase database
class DatabaseSwitcher {
  async getDatabase() {
    try {
      // Get the current user
      const user = await getCurrentUser();
      
      // Set the user ID in the database instance if available
      if (user) {
        console.log(`Using Supabase database with user ID: ${user.id}`);
        supabaseDB.setCurrentUserId(user.id);
      } else {
        console.log('Using Supabase database (not authenticated)');
        supabaseDB.setCurrentUserId(null);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    
    return supabaseDB;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
