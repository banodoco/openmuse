
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
  private authCheckCooldown = 10000; // Increased to 10 seconds cooldown between checks
  private currentUserId: string | null = null;
  private sessionPromise: Promise<void> | null = null;
  
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
      
      // If we already have a pending session check, wait for it
      if (this.sessionPromise) {
        await this.sessionPromise;
        return supabaseDatabaseOperations;
      }
      
      this.isCheckingAuth = true;
      this.lastAuthCheck = now;
      
      // Create a new session check promise
      this.sessionPromise = new Promise<void>(async (resolve) => {
        try {
          this.logger.log("Getting current user");
          
          // Simplified session check with proper error handling
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            this.logger.error("Session check error:", error);
            // Only clear user ID if we previously had one and now we don't
            if (this.currentUserId !== null) {
              this.currentUserId = null;
              supabaseDatabaseOperations.setCurrentUserId(null);
            }
          } else if (data.session?.user) {
            const userId = data.session.user.id;
            
            // Only update if the user ID changed
            if (this.currentUserId !== userId) {
              this.logger.log(`User authenticated from session, ID: ${userId}`);
              this.currentUserId = userId;
              supabaseDatabaseOperations.setCurrentUserId(userId);
            }
          } else if (this.currentUserId !== null) {
            // Only clear if we previously had a user ID
            this.logger.log('Not authenticated, using anonymous access');
            this.currentUserId = null;
            supabaseDatabaseOperations.setCurrentUserId(null);
          }
        } catch (sessionError) {
          this.logger.error("Error checking session:", sessionError);
        } finally {
          this.isCheckingAuth = false;
          this.sessionPromise = null;
          resolve();
        }
      });
      
      // Wait for the session check to complete
      await this.sessionPromise;
    } catch (error) {
      this.logger.error('Error in getDatabase:', error);
      this.isCheckingAuth = false;
      this.sessionPromise = null;
    }
    
    return supabaseDatabaseOperations;
  }
}

// Create and export a singleton instance
export const databaseProvider = new DatabaseProvider();
