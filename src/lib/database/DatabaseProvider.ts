import { supabaseDatabaseOperations } from './SupabaseDatabaseOperations';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';
import { BaseDatabase } from './BaseDatabase';

const PROVIDER_VERSION = '1.2.0';
const LOG_TAG = 'SessionPersist';

/**
 * Database provider that returns the appropriate database implementation
 * and handles authentication state checks asynchronously.
 */
export class DatabaseProvider {
  private readonly logger = new Logger(`DatabaseProvider[v${PROVIDER_VERSION}]`, true, LOG_TAG);
  private isCheckingAuth = false;
  private lastAuthCheck = 0;
  private authCheckCooldown = 10000; // 10 seconds cooldown between checks
  private currentUserId: string | null = null;
  private sessionPromise: Promise<void> | null = null;
  private lastError: Error | null = null;

  /**
   * Asynchronously checks the session and updates the user ID for the database operations.
   * This function manages its own cooldown and prevents concurrent checks.
   */
  private async checkSessionAndUpdateUserId(): Promise<void> {
    const now = Date.now();

    // Prevent concurrent or too frequent auth checks
    if (this.isCheckingAuth || (now - this.lastAuthCheck < this.authCheckCooldown)) {
      this.logger.log(`[v${PROVIDER_VERSION}][checkSession] Auth check skipped (in progress or cooldown active).`);
      // If a check is already in progress, wait for it
      if (this.sessionPromise) {
        try {
          await this.sessionPromise;
        } catch (e) { /* Ignore errors here, handled by the original promise */ }
      }
      return;
    }

    this.isCheckingAuth = true;
    this.lastAuthCheck = now;
    this.lastError = null;

    const checkStart = performance.now();

    this.sessionPromise = new Promise<void>(async (resolve, reject) => {
      try {
        this.logger.log(`[v${PROVIDER_VERSION}][checkSession] Starting session check.`);

        // Create a timeout promise (increased slightly as a safeguard)
        const timeoutPromise = new Promise<never>((_, rejectTimeout) => {
          setTimeout(() => rejectTimeout(new Error('Session check timed out')), 15000); // Increased to 15s
        });

        // Race between session check and timeout
        const { data, error } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);

        if (error) {
          this.logger.error(`[v${PROVIDER_VERSION}][checkSession] Session check error:`, error);
          this.lastError = error;
          if (this.currentUserId !== null) {
            this.logger.log(`[v${PROVIDER_VERSION}][checkSession] Clearing user ID due to error.`);
            this.currentUserId = null;
            supabaseDatabaseOperations.setCurrentUserId(null);
          }
          reject(error); // Reject the promise on error
        } else {
          const newUserId = data?.session?.user?.id || null;
          if (this.currentUserId !== newUserId) {
            this.logger.log(`[v${PROVIDER_VERSION}][checkSession] User ID changed: ${this.currentUserId} -> ${newUserId}`);
            this.currentUserId = newUserId;
            supabaseDatabaseOperations.setCurrentUserId(newUserId);
          }
          resolve(); // Resolve the promise on success
        }
      } catch (error) {
        this.logger.error(`[v${PROVIDER_VERSION}][checkSession] Unexpected error:`, error);
        this.lastError = error as Error;
        // Ensure user ID is cleared on unexpected errors if it was set
        if (this.currentUserId !== null) {
          this.logger.log(`[v${PROVIDER_VERSION}][checkSession] Clearing user ID due to unexpected error.`);
          this.currentUserId = null;
          supabaseDatabaseOperations.setCurrentUserId(null);
        }
        reject(error); // Reject the promise on unexpected error
      } finally {
        const duration = (performance.now() - checkStart).toFixed(2);
        this.logger.log(`[v${PROVIDER_VERSION}][checkSession] Session check finished in ${duration} ms.`);
        this.isCheckingAuth = false;
        // We clear the sessionPromise *after* the cooldown period has effectively passed
        // to prevent immediate re-checks if getDatabase is called rapidly.
        // This might not be strictly necessary with the isCheckingAuth flag, but adds robustness.
        // setTimeout(() => { this.sessionPromise = null; }, this.authCheckCooldown); \
        // --> Let's actually clear it immediately now that we have isCheckingAuth
        this.sessionPromise = null;
      }
    });

    try {
      await this.sessionPromise; // Wait for the current check to complete
    } catch (e) {
      this.logger.warn(`[v${PROVIDER_VERSION}][checkSession] Caught error from sessionPromise, but allowing getDatabase to proceed. Error:`, e);
      // Don't re-throw, let getDatabase return the instance anyway
    }
  }

  /**
   * Get the database operations instance.
   * It triggers an asynchronous session check if needed but returns the instance immediately.
   */
  getDatabase(): BaseDatabase {
    this.logger.log(`[v${PROVIDER_VERSION}] getDatabase() called.`);
    // Trigger the session check, but don't wait for it.
    // The checkSessionAndUpdateUserId function handles its own locking and cooldown.
    this.checkSessionAndUpdateUserId();

    // Return the database operations instance immediately.
    // The user ID will be updated asynchronously if necessary.
    return supabaseDatabaseOperations;
  }
}

// Create and export a singleton instance
export const databaseProvider = new DatabaseProvider();
