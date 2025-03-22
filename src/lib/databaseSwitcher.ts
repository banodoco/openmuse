
import { supabaseDB } from './supabaseDB';
import { getCurrentUser } from './auth';
import { supabase } from './supabase';
import { Logger } from './logger';

// A database provider that always returns Supabase database
class DatabaseSwitcher {
  private readonly logger = new Logger('DatabaseSwitcher');
  private isCheckingAuth = false;
  private lastAuthCheck = 0;
  private authCheckCooldown = 5000; // 5 seconds cooldown between checks
  
  async getDatabase() {
    try {
      const now = Date.now();
      
      // Prevent too frequent auth checks
      if (this.isCheckingAuth || (now - this.lastAuthCheck < this.authCheckCooldown)) {
        this.logger.log("Auth check prevented (in progress or cooldown active), using current database state");
        return supabaseDB;
      }
      
      this.isCheckingAuth = true;
      this.lastAuthCheck = now;
      this.logger.log("Getting current user");
      
      // Simplified session check with proper error handling
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          this.logger.error("Session check error:", error);
          supabaseDB.setCurrentUserId(null);
          return supabaseDB;
        }
        
        if (data.session?.user) {
          this.logger.log(`User authenticated from session, ID: ${data.session.user.id}`);
          supabaseDB.setCurrentUserId(data.session.user.id);
        } else {
          this.logger.log('Not authenticated, using anonymous access');
          supabaseDB.setCurrentUserId(null);
        }
      } catch (sessionError) {
        this.logger.error("Error checking session:", sessionError);
        supabaseDB.setCurrentUserId(null);
      }
    } catch (error) {
      this.logger.error('Error in getDatabase:', error);
      supabaseDB.setCurrentUserId(null);
    } finally {
      this.isCheckingAuth = false;
    }
    
    return supabaseDB;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
