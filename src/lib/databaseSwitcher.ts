
import { supabaseDB } from './supabaseDB';
import { getCurrentUser, signOut } from './auth';
import { supabase } from './supabase';
import { Logger } from './logger';
import { toast } from 'sonner';

// A database provider that always returns Supabase database
class DatabaseSwitcher {
  private readonly logger = new Logger('DatabaseSwitcher');
  private isCheckingAuth = false;
  private lastAuthCheck = 0;
  private authCheckCooldown = 5000; // 5 seconds cooldown between checks
  private lastInvalidUserCheck = 0;
  private invalidUserCheckCooldown = 30000; // 30 seconds between checking if user is still valid
  
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
          const userId = data.session.user.id;
          this.logger.log(`User authenticated from session, ID: ${userId}`);
          
          // Periodically check if the user still exists in the database
          if (now - this.lastInvalidUserCheck > this.invalidUserCheckCooldown) {
            this.lastInvalidUserCheck = now;
            this.logger.log("Validating user still exists in database");
            
            const { data: userExists, error: userCheckError } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', userId)
              .single();
            
            if (userCheckError || !userExists) {
              this.logger.error("User no longer exists in database:", userCheckError || "No profile found");
              toast.error("Your session is no longer valid. Please sign in again.");
              await signOut();
              supabaseDB.setCurrentUserId(null);
              return supabaseDB;
            }
            
            this.logger.log("User validation successful");
          }
          
          supabaseDB.setCurrentUserId(userId);
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
