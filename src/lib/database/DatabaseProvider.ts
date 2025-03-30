
import { supabaseDatabaseOperations } from './SupabaseDatabaseOperations';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';
import { BaseDatabase } from './BaseDatabase';

/**
 * Database provider that returns the appropriate database implementation
 * and handles authentication state
 */
export class DatabaseProvider {
  private readonly logger = new Logger('DatabaseProvider');
  private isCheckingAuth = false;
  private lastAuthCheck = 0;
  private authCheckCooldown = 5000; // 5 seconds cooldown between checks
  private lastInvalidUserCheck = 0;
  private invalidUserCheckCooldown = 60000; // 60 seconds between checking if user is still valid
  
  /**
   * Get the appropriate database instance based on current configuration
   * and handle setting the current user ID
   */
  async getDatabase(): Promise<BaseDatabase> {
    try {
      const now = Date.now();
      
      // Prevent too frequent auth checks
      if (this.isCheckingAuth || (now - this.lastAuthCheck < this.authCheckCooldown)) {
        this.logger.log("Auth check prevented (in progress or cooldown active), using current database state");
        return supabaseDatabaseOperations;
      }
      
      this.isCheckingAuth = true;
      this.lastAuthCheck = now;
      this.logger.log("Getting current user");
      
      // Simplified session check with proper error handling
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          this.logger.error("Session check error:", error);
          supabaseDatabaseOperations.setCurrentUserId(null);
          return supabaseDatabaseOperations;
        }
        
        if (data.session?.user) {
          const userId = data.session.user.id;
          this.logger.log(`User authenticated from session, ID: ${userId}`);
          supabaseDatabaseOperations.setCurrentUserId(userId);
        } else {
          this.logger.log('Not authenticated, using anonymous access');
          supabaseDatabaseOperations.setCurrentUserId(null);
        }
      } catch (sessionError) {
        this.logger.error("Error checking session:", sessionError);
        supabaseDatabaseOperations.setCurrentUserId(null);
      }
    } catch (error) {
      this.logger.error('Error in getDatabase:', error);
      supabaseDatabaseOperations.setCurrentUserId(null);
    } finally {
      this.isCheckingAuth = false;
    }
    
    return supabaseDatabaseOperations;
  }
}

// Create and export a singleton instance
export const databaseProvider = new DatabaseProvider();
