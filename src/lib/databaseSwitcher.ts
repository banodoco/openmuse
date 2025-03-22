
import { supabaseDB } from './supabaseDB';
import { getCurrentUser } from './auth';
import { supabase } from './supabase';
import { Logger } from './logger';

// A database provider that always returns Supabase database
class DatabaseSwitcher {
  private readonly logger = new Logger('DatabaseSwitcher');
  
  async getDatabase() {
    try {
      this.logger.log("Getting current user");
      
      // Log current session status directly
      const { data: { session } } = await supabase.auth.getSession();
      this.logger.log(`Direct session check: ${session?.user ? 'Authenticated as ' + session.user.id : 'Not authenticated'}`);
      
      // Get the current user
      const user = await getCurrentUser();
      
      // Set the user ID in the database instance if available
      if (user) {
        this.logger.log(`User authenticated, ID: ${user.id}`);
        supabaseDB.setCurrentUserId(user.id);
      } else {
        this.logger.log('Not authenticated, using anonymous access');
        supabaseDB.setCurrentUserId(null);
      }
    } catch (error) {
      this.logger.error('Error getting current user:', error);
      supabaseDB.setCurrentUserId(null);
    }
    
    return supabaseDB;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
