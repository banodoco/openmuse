import { supabaseDatabaseOperations } from './SupabaseDatabaseOperations';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';
import { BaseDatabase } from './BaseDatabase';

const PROVIDER_VERSION = '1.1.0';
const LOG_TAG = 'SessionPersist'; // Define the tag

/**
 * Database provider that returns the appropriate database implementation
 * and handles authentication state
 */
export class DatabaseProvider {
  private readonly logger = new Logger(`DatabaseProvider[v${PROVIDER_VERSION}]`, true, LOG_TAG);
  private isCheckingAuth = false;
  private lastAuthCheck = 0;
  private authCheckCooldown = 10000; // 10 seconds cooldown between checks
  private currentUserId: string | null = null;
  private sessionPromise: Promise<void> | null = null;
  private lastError: Error | null = null;
  private completionPromise: Promise<void> | null = null;
  
  /**
   * Get the appropriate database instance based on current configuration
   * and handle setting the current user ID
   */
  async getDatabase(): Promise<BaseDatabase> {
    try {
      const now = Date.now();
      
      // If we have a completion promise from a previous call, wait for it
      if (this.completionPromise) {
        this.logger.log(`[v${PROVIDER_VERSION}] Waiting for previous operation to complete...`);
        await this.completionPromise;
      }

      // If we had an error in the last attempt, wait before retrying
      if (this.lastError && (now - this.lastAuthCheck < this.authCheckCooldown)) {
        this.logger.warn(`[v${PROVIDER_VERSION}] Recent error, waiting before retry:`, this.lastError);
        return supabaseDatabaseOperations;
      }
      
      // Prevent concurrent auth checks
      if (this.isCheckingAuth) {
        this.logger.log(`[v${PROVIDER_VERSION}] Auth check in progress, using current database state`);
        return supabaseDatabaseOperations;
      }
      
      // If we already have a pending session check, wait for it
      if (this.sessionPromise) {
        await this.sessionPromise;
        return supabaseDatabaseOperations;
      }
      
      this.isCheckingAuth = true;
      this.lastAuthCheck = now;
      this.lastError = null;
      
      const checkStart = performance.now();
      
      // Create a new completion promise
      this.completionPromise = new Promise<void>(async (resolve, reject) => {
        try {
          this.logger.log(`[v${PROVIDER_VERSION}] Getting current user`);
          
          // Create a timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Database provider timeout')), 10000);
          });
          
          // Race between session check and timeout
          const { data, error } = await Promise.race([
            supabase.auth.getSession(),
            timeoutPromise
          ]);
          
          if (error) {
            this.logger.error(`[v${PROVIDER_VERSION}] Session check error:`, error);
            this.lastError = error;
            // Only clear user ID if we previously had one and now we don't
            if (this.currentUserId !== null) {
              this.currentUserId = null;
              supabaseDatabaseOperations.setCurrentUserId(null);
            }
          } else if (data?.session?.user) {
            const userId = data.session.user.id;
            
            // Only update if the user ID changed
            if (this.currentUserId !== userId) {
              this.logger.log(`[v${PROVIDER_VERSION}] Session found. User ID: ${userId}`);
              this.currentUserId = userId;
              supabaseDatabaseOperations.setCurrentUserId(userId);
            }
          } else if (this.currentUserId !== null) {
            // Only clear if we previously had a user ID
            this.logger.log(`[v${PROVIDER_VERSION}] No session. Using anonymous access`);
            this.currentUserId = null;
            supabaseDatabaseOperations.setCurrentUserId(null);
          }
          
          resolve();
        } catch (error) {
          this.logger.error(`[v${PROVIDER_VERSION}] Error in getDatabase:`, error);
          this.lastError = error as Error;
          reject(error);
        } finally {
          this.isCheckingAuth = false;
          this.sessionPromise = null;
          const duration = (performance.now() - checkStart).toFixed(2);
          this.logger.log(`[v${PROVIDER_VERSION}] Session check finished in ${duration} ms`);
        }
      });
      
      // Wait for completion
      await this.completionPromise;
      
    } catch (error) {
      this.logger.error('Error in getDatabase:', error);
      this.lastError = error as Error;
      this.isCheckingAuth = false;
      this.sessionPromise = null;
    } finally {
      // Clear completion promise
      this.completionPromise = null;
    }
    
    return supabaseDatabaseOperations;
  }
}

// Create and export a singleton instance
export const databaseProvider = new DatabaseProvider();
