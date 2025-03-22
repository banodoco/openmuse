
import { supabaseDB } from './supabaseDB';
import { getCurrentUser } from './auth';
import { supabase } from './supabase';
import { Logger } from './logger';

// A database provider that always returns Supabase database
class DatabaseSwitcher {
  private readonly logger = new Logger('DatabaseSwitcher');
  private isCheckingAuth = false;
  
  async getDatabase() {
    try {
      // Prevent multiple concurrent auth checks
      if (this.isCheckingAuth) {
        this.logger.log("Auth check already in progress, using current database state");
        return supabaseDB;
      }
      
      this.isCheckingAuth = true;
      this.logger.log("Getting current user");
      
      // Log current session status directly
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        this.logger.error("Session check error:", error);
        supabaseDB.setCurrentUserId(null);
        this.isCheckingAuth = false;
        return supabaseDB;
      }
      
      this.logger.log(`Direct session check: ${session?.user ? 'Authenticated as ' + session.user.id : 'Not authenticated'}`);
      
      // Use session user directly if available instead of making another call
      if (session?.user) {
        this.logger.log(`User authenticated from session, ID: ${session.user.id}`);
        supabaseDB.setCurrentUserId(session.user.id);
      } else {
        // Fallback to getCurrentUser if needed
        const user = await getCurrentUser();
        
        if (user) {
          this.logger.log(`User authenticated from getCurrentUser, ID: ${user.id}`);
          supabaseDB.setCurrentUserId(user.id);
        } else {
          this.logger.log('Not authenticated, using anonymous access');
          supabaseDB.setCurrentUserId(null);
        }
      }
    } catch (error) {
      this.logger.error('Error getting current user:', error);
      supabaseDB.setCurrentUserId(null);
    } finally {
      this.isCheckingAuth = false;
    }
    
    return supabaseDB;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
