import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { checkIsAdmin } from '@/lib/auth';

const logger = new Logger('AuthProvider');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Add a version marker log
  logger.log('--- AuthProvider Module Execution (v8 - Fix Direct Navigation) ---');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Tracks Supabase initial auth check
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminCheckInProgress, setIsAdminCheckInProgress] = useState<boolean>(false); // Tracks the async admin check
  const [isAdminStatusKnown, setIsAdminStatusKnown] = useState<boolean>(false); // Tracks if admin status check has completed for the current user

  const isMounted = useRef(true);
  const refreshInProgress = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const initialSessionCheckComplete = useRef<boolean>(false);
  
  // Effect to check admin status *only* when user changes
  useEffect(() => {
    let isActive = true;
    setIsAdminStatusKnown(false); // Reset admin status knowledge when user changes

    const verifyAdminStatus = async (userId: string) => {
      logger.log('Checking admin status for user:', userId);
      setIsAdminCheckInProgress(true); // Mark check as started
      let attempt = 1;
      const maxAttempts = 2;
      const retryDelay = 500;

      while (attempt <= maxAttempts) {
        if (!isActive) {
          // Don't update state if component unmounted during check
          return; 
        }

        try {
          const userIsAdmin = await checkIsAdmin(userId);
          if (isActive) {
            if (userIsAdmin) {
              setIsAdmin(true); // Set admin status
              setIsAdminStatusKnown(true); // Mark status as known
              setIsAdminCheckInProgress(false); // Check complete (success)
              logger.log(`Attempt ${attempt}: User is admin. Status known, check complete.`);
              return; 
            } else {
               logger.log(`Attempt ${attempt}: User is not admin (check returned false)`);
            }
          }
        } catch (error) {
          logger.error(`Attempt ${attempt}: Error checking admin status:`, error);
        }

        if (attempt < maxAttempts) {
          logger.log(`Attempt ${attempt} failed, retrying after ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
           if (isActive) {
             logger.warn(`Max attempts (${maxAttempts}) reached for admin check. Concluding user is not admin.`);
             setIsAdmin(false); // Set admin status to false
             setIsAdminStatusKnown(true); // Mark status as known
             setIsAdminCheckInProgress(false); // Check complete (failure after retries)
             logger.log('Admin check failed after retries. Status known, check complete.');
           }
        }
        attempt++;
      }
    };

    // Only run the check if we have a user object
    if (user) {
      verifyAdminStatus(user.id);
    } else {
      // If there's no user, ensure admin status is false and status is known
      setIsAdmin(false);
      setIsAdminStatusKnown(true); // Admin status is known (false) when no user
      setIsAdminCheckInProgress(false); // No check is in progress
    }

    return () => {
      isActive = false;
    };
    // Re-run only when the user object reference changes.
  }, [user]); 

  useEffect(() => {
    logger.log('Setting up auth provider');
    isMounted.current = true; // Ensure mounted flag is true on setup
    initialSessionCheckComplete.current = false;

    // Immediately check for an existing session when the component mounts
    const checkInitialSession = async () => {
      try {
        logger.log('Checking for existing session on mount');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error getting initial session:', error);
          setIsInitialLoading(false);
          initialSessionCheckComplete.current = true;
          return;
        }
        
        if (data.session) {
          logger.log('Initial session found:', data.session.user.id);
          setSession(data.session);
          setUser(data.session.user);
          lastRefreshTime.current = Date.now();
        } else {
          logger.log('No initial session found');
        }
        
        // Mark initial loading as complete after checking session
        setIsInitialLoading(false);
        initialSessionCheckComplete.current = true;
      } catch (error) {
        logger.error('Unexpected error during initial session check:', error);
        setIsInitialLoading(false);
        initialSessionCheckComplete.current = true;
      }
    };
    
    // Run the initial session check immediately
    checkInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        logger.log('--- onAuthStateChange Callback Executing ---');
        
        if (!isMounted.current) return;
        
        logger.log(`Auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        
        // Handle auth events appropriately
        if (currentSession) {
          // Always update session if present
          setSession(currentSession);
          lastRefreshTime.current = Date.now(); // Update last refresh on any valid session event
          
          // Update user only if it changed, triggers the admin check effect
          if (!user || user.id !== currentSession.user.id) {
             logger.log('User ID changed or user newly logged in. Setting user state.');
             setIsAdmin(false); // Reset admin status before check
             setIsAdminStatusKnown(false); // Reset admin status knowledge
             setIsAdminCheckInProgress(true); // Indicate check will start
             setUser(currentSession.user); // This will trigger the admin check useEffect
          } else if (event === 'TOKEN_REFRESHED') {
             logger.log('Token refreshed for the same user.');
             // No need to re-trigger admin check if user is the same
          } else if (event === 'SIGNED_IN') {
             logger.log('User explicitly signed in.');
             // User state update is handled above if needed
          }
          
        } else { // No currentSession (SIGNED_OUT or session expired)
           logger.log('No session found in auth event.');
           if (user !== null) { // Only update state if user actually changes to null
             logger.log('User is now null. Clearing user state.');
             setUser(null); // This will trigger the admin check useEffect to clear admin state
           }
           setSession(null);
           setIsAdmin(false); // Ensure admin is false if no session
           setIsAdminStatusKnown(true); // Admin status is known (false) if no user
           setIsAdminCheckInProgress(false); // No admin check needed if no user
        }
        
        // Mark initial loading as complete after processing auth state change
        if (isInitialLoading && initialSessionCheckComplete.current) {
          setIsInitialLoading(false);
        }
      }
    );

    // Session refresh interval
    const refreshIntervalId = setInterval(async () => {
      if (!isMounted.current || !session || refreshInProgress.current) return;
      const now = Date.now();
      if (now - lastRefreshTime.current < 5 * 60 * 1000) return;
      
      try {
        logger.log('Refreshing session token via interval');
        refreshInProgress.current = true;
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          logger.error('Failed to refresh session via interval:', error);
          return;
        } 
        if (data.session) {
          setSession(data.session);
          // Update user only if it changed to prevent unnecessary admin check trigger
          if (!user || user.id !== data.session.user.id) {
             setUser(data.session.user); 
          }
          logger.log('Session refreshed successfully via interval');
          lastRefreshTime.current = now;
        } else {
          logger.warn('Interval session refresh returned no session, but no error');
        }
      } catch (error) {
        logger.error('Error in session refresh interval:', error);
      } finally {
        refreshInProgress.current = false;
      }
    }, 2 * 60 * 1000);
    
    return () => {
      logger.log('Cleaning up auth provider subscription and interval');
      isMounted.current = false;
      subscription.unsubscribe();
      clearInterval(refreshIntervalId);
    };
  }, []); // Run setup only once

  const signIn = async (email: string, password: string) => {
    try {
      // Set loading true immediately for better UX feedback during sign-in attempt
      // Note: This doesn't use the main loading states, just provides visual feedback
      toast.loading('Signing in...', { id: 'signin-toast' }); 
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      toast.dismiss('signin-toast'); // Dismiss loading toast

      if (error) throw error;
      
      // State update (user, session, isAdmin) will be handled by onAuthStateChange
      if (data.session) {
        logger.log('Sign in successful, waiting for onAuthStateChange.');
      } else {
         logger.warn('Sign in successful but no session data received immediately.');
      }

    } catch (error: any) {
      toast.dismiss('signin-toast');
      toast.error(error.message || 'Error signing in');
      logger.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      toast.loading('Signing out...', { id: 'signout-toast' });
      const { error } = await supabase.auth.signOut();
      toast.dismiss('signout-toast');
      if (error) throw error;
      // State update handled by onAuthStateChange listener
      logger.log('Sign out successful, waiting for onAuthStateChange.');
    } catch (error: any) {
      toast.dismiss('signout-toast');
      toast.error(error.message || 'Error signing out');
      logger.error('Sign out error:', error);
    }
  };

  // Combine initial loading and admin status knowledge for the exposed isLoading value
  // Loading is true if:
  // 1. Supabase initial check is ongoing OR
  // 2. We have a user BUT their admin status isn't known yet.
  const combinedIsLoading = isInitialLoading || (!!user && !isAdminStatusKnown);

  logger.log(`AuthProvider State: isInitialLoading=${isInitialLoading}, user=${!!user}, session=${!!session}, isAdminStatusKnown=${isAdminStatusKnown}, combinedIsLoading=${combinedIsLoading}, isAdmin=${isAdmin}`);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        isAdmin, 
        isLoading: combinedIsLoading, // Use the combined loading state
        signIn, 
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
