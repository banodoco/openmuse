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
  logger.log('--- AuthProvider Module Execution (v6 - Separate Admin Loading State) ---');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Tracks Supabase initial auth check
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminCheckInProgress, setIsAdminCheckInProgress] = useState<boolean>(false); // Tracks the async admin check

  const isMounted = useRef(true);
  const refreshInProgress = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  
  // Effect to check admin status *only* when user changes
  useEffect(() => {
    let isActive = true;

    const verifyAdminStatus = async (userId: string) => {
      logger.log('Checking admin status for user:', userId);
      setIsAdminCheckInProgress(true); // Mark check as started
      let attempt = 1;
      const maxAttempts = 2;
      const retryDelay = 500;

      while (attempt <= maxAttempts) {
        if (!isActive) {
          setIsAdminCheckInProgress(false); // Ensure state is cleared if unmounted during check
          return;
        }

        try {
          const userIsAdmin = await checkIsAdmin(userId);
          if (isActive) {
            if (userIsAdmin) {
              setIsAdmin(true);
              logger.log(`Attempt ${attempt}: User is admin`);
              setIsAdminCheckInProgress(false); // Check complete (success)
              logger.log('Admin status resolved successfully, isAdminCheckInProgress set false.');
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
             setIsAdmin(false);
             setIsAdminCheckInProgress(false); // Check complete (failure)
             logger.log('Admin check failed after retries, isAdminCheckInProgress set false.');
           }
        }
        attempt++;
      }
    };

    // Only run the check if we have a user object
    if (user) {
      verifyAdminStatus(user.id);
    } else {
      // If there's no user, ensure admin status is false and check is not in progress
      setIsAdmin(false);
      setIsAdminCheckInProgress(false);
    }

    return () => {
      isActive = false;
    };
    // Re-run only when the user object reference changes.
  }, [user]); 

  useEffect(() => {
    logger.log('Setting up auth provider');
    isMounted.current = true; // Ensure mounted flag is true on setup

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        logger.log('--- onAuthStateChange Callback Executing ---');
        
        if (!isMounted.current) return;
        
        logger.log(`Auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        
        // Handle INITIAL_SESSION first to determine end of initial loading
        if (event === 'INITIAL_SESSION') {
           logger.log('INITIAL_SESSION event received.');
           setIsInitialLoading(false); // Supabase initial check is complete
        }
        
        if (currentSession) {
          // Always update session if present
          setSession(currentSession);
          lastRefreshTime.current = Date.now(); // Update last refresh on any valid session event
          
          // Update user only if it changed, triggers the admin check effect
          if (user?.id !== currentSession.user.id) {
             logger.log('User ID changed or user newly logged in. Setting user state.');
             setIsAdmin(false); // Reset admin status before check
             setIsAdminCheckInProgress(true); // Indicate check will start
             setUser(currentSession.user); // This will trigger the admin check useEffect
          } else if (event === 'TOKEN_REFRESHED') {
             logger.log('Token refreshed for the same user.');
             // No need to re-trigger admin check if user is the same
          } else if (event === 'INITIAL_SESSION') {
              // If initial session finds a user, set it (will trigger admin check)
              logger.log('Initial session has a user. Setting user state.');
              setIsAdmin(false);
              setIsAdminCheckInProgress(true);
              setUser(currentSession.user);
          } else if (event === 'SIGNED_IN') {
             logger.log('User explicitly signed in.');
             setIsAdmin(false); 
             setIsAdminCheckInProgress(true);
             setUser(currentSession.user);
          }
          
        } else { // No currentSession (SIGNED_OUT or INITIAL_SESSION without user)
           logger.log('No session found in auth event.');
           if (user !== null) { // Only update state if user actually changes to null
             logger.log('User is now null. Clearing user state.');
             setUser(null); // This will trigger the admin check useEffect to clear admin state
           }
           setSession(null);
           setIsAdmin(false); // Ensure admin is false if no session
           setIsAdminCheckInProgress(false); // No admin check needed if no user
           
           // If INITIAL_SESSION finished without a user, isInitialLoading is already false.
           // If SIGNED_OUT, isInitialLoading was likely already false.
        }
      }
    );

    // Session refresh interval (unchanged logic)
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
          if (user?.id !== data.session.user.id) {
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

  // Combine initial loading and admin check status for the exposed isLoading value
  const combinedIsLoading = isInitialLoading || isAdminCheckInProgress;

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
