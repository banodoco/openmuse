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
  logger.log('--- AuthProvider Module Execution (v5 - Unconditional isLoading) ---');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  const isMounted = useRef(true);
  const refreshInProgress = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  
  // Effect to check admin status whenever user changes OR initial loading finishes
  useEffect(() => {
    let isActive = true;

    const verifyAdminStatus = async (userId: string) => {
      logger.log('Checking admin status for user:', userId);
      let attempt = 1;
      const maxAttempts = 2; // Try twice
      const retryDelay = 500; // ms

      while (attempt <= maxAttempts) {
        if (!isActive) return; // Stop if component unmounted

        try {
          const userIsAdmin = await checkIsAdmin(userId);
          if (isActive) {
            if (userIsAdmin) { // Only set loading false on SUCCESS
              setIsAdmin(true);
              logger.log(`Attempt ${attempt}: User is admin`);
              setIsLoading(false); // Set loading false only if admin check succeeded
              logger.log('Admin status resolved successfully, setting isLoading false.');
              return; // Success, exit the loop and function
            } else {
               logger.log(`Attempt ${attempt}: User is not admin (check returned false)`);
               // Don't set isLoading false yet, proceed to retry logic
            }
          }
        } catch (error) {
          logger.error(`Attempt ${attempt}: Error checking admin status:`, error);
          // Fall through to potentially retry
        }

        // If try block finished without returning (i.e., userIsAdmin was false)
        // or if catch block was executed, proceed to retry logic:

        if (attempt < maxAttempts) {
          logger.log(`Attempt ${attempt} failed, retrying after ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
           // Max attempts reached, conclude failure
           if (isActive) {
             logger.warn(`Max attempts (${maxAttempts}) reached for admin check. Concluding user is not admin.`);
             setIsAdmin(false);
             setIsLoading(false); 
             logger.log('Admin check failed after retries, setting isLoading false.');
           }
        }
        attempt++;
      }
    };

    // Decision logic:
    // 1. If we have a user object AND we are still in the initial loading phase:
    //    This is the primary case after onAuthStateChange confirms a user. Check admin status.
    if (user && isLoading) {
      verifyAdminStatus(user.id);
    }
    // 2. If we DON'T have a user object AND we ARE still loading:
    //    This means the initial check is done (INITIAL_SESSION fired) but found no user.
    //    Set loading to false.
    else if (!user && isLoading) {
      logger.log('Initial check complete, no user found. Setting isLoading false.');
      if (isActive) { // Check if component is still mounted
        setIsLoading(false);
      }
    }
    // 3. If we DON'T have a user object AND we are NOT loading anymore:
    //    This means either initial check found no user, or user logged out. Ensure isAdmin is false.
    else if (!user && !isLoading) {
      if (isActive && isAdmin) { // Only change if it was previously true
         setIsAdmin(false);
         logger.log('User is null and not loading, ensuring isAdmin is false.');
      }
    }
    // 4. If we HAVE a user object AND we are NOT loading:
    //    This means we already loaded and checked admin status. Do nothing on subsequent renders
    //    unless user object itself changes (handled by dependency array).
    else if (user && !isLoading) {
       logger.log('Already loaded and checked admin status for this user.');
    }

    return () => {
      isActive = false;
    };
    // Re-run whenever user object reference changes or isLoading status changes.
  }, [user, isLoading]);

  useEffect(() => {
    logger.log('Setting up auth provider');
    
    // Set up the auth state change listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        // Add a log to confirm the callback itself is running the latest code
        logger.log('--- onAuthStateChange Callback Executing ---');
        
        if (!isMounted.current) return;
        
        logger.log(`Auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        
        let userChanged = false; // Track if user actually changed
        
        if (currentSession) {
          // Set loading true FIRST to ensure admin check effect runs
          setIsLoading(true); 
          logger.log('Session detected, explicitly setting isLoading true to trigger admin check.');
          
          if (user?.id !== currentSession.user.id) {
             setUser(currentSession.user);
             userChanged = true;
          }
          setSession(currentSession);
          
          if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
            lastRefreshTime.current = Date.now();
            logger.log('Session refreshed via auth state change');
          }
          // Keep isLoading=true until the admin check effect runs
        } else if (event === 'SIGNED_OUT') {
          if (user !== null) { // Check if user actually changed to null
             setUser(null);
             userChanged = true;
          }
          setSession(null);
          setIsAdmin(false);
           // If signed out, we are done loading.
           setIsLoading(false); 
           logger.log('Signed out, setting isLoading false.');
        } else if (event === 'INITIAL_SESSION' && !currentSession) {
           // Handle case where initial check finds no session
           setUser(null);
           setSession(null);
           setIsAdmin(false);
           logger.log('Initial session check found no user. User/Admin state cleared.');
        }
        
        // The INITIAL_SESSION event marks the end of Supabase's initial check.
        // If there IS a session, the admin check effect will handle setting isLoading=false.
        // If there's NO session (handled above), isLoading is already set to false.
      }
    );

    // Set up session refresh on interval with better error handling and throttling
    const refreshIntervalId = setInterval(async () => {
      if (!isMounted.current) return;
      if (!session) return; // Skip if no session
      if (refreshInProgress.current) return; // Skip if refresh already in progress
      
      // Only refresh if it's been at least 5 minutes since last refresh
      const now = Date.now();
      if (now - lastRefreshTime.current < 5 * 60 * 1000) {
        return;
      }
      
      try {
        logger.log('Refreshing session token');
        refreshInProgress.current = true;
        
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          logger.error('Failed to refresh session:', error);
          // Don't force logout here - let the next attempt try again
          return;
        } 
        
        if (data.session) {
          // Atomically update both session and user state
          setSession(data.session);
          setUser(data.session.user);
          logger.log('Session refreshed successfully via interval');
          lastRefreshTime.current = now;
        } else {
          logger.warn('Session refresh returned no session, but no error');
        }
      } catch (error) {
        logger.error('Error in session refresh interval:', error);
        // Don't log out on error - be resilient
      } finally {
        refreshInProgress.current = false;
      }
    }, 2 * 60 * 1000); // Check every 2 minutes but only refresh after 5+ minutes
    
    return () => {
      logger.log('Cleaning up auth provider subscription and interval');
      isMounted.current = false;
      subscription.unsubscribe();
      clearInterval(refreshIntervalId);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) throw error;
      
      if (data.session) {
        // Update both atomically
        setUser(data.session.user);
        setSession(data.session);
        lastRefreshTime.current = Date.now();
      }
    } catch (error: any) {
      toast.error(error.message || 'Error signing in');
      logger.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear auth state - handled by listener now more reliably
      // setUser(null);
      // setSession(null);
      // setIsAdmin(false);
    } catch (error: any) {
      toast.error(error.message || 'Error signing out');
      logger.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
