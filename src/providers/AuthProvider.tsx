import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { checkIsAdmin } from '@/lib/auth';

const logger = new Logger('AuthProvider');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
      // This function should only be called when we are reasonably sure
      // we need to check the status and then set loading to false.
      logger.log('Checking admin status for user:', userId);
      try {
        const userIsAdmin = await checkIsAdmin(userId);
        if (isActive) {
          setIsAdmin(userIsAdmin);
          logger.log(`User admin status: ${userIsAdmin ? 'is admin' : 'not admin'}`);
          setIsLoading(false); // Now we are loaded
          logger.log('Admin status checked, setting isLoading false.');
        }
      } catch (error) {
        logger.error('Error checking admin status:', error);
        if (isActive) {
          setIsAdmin(false);
          setIsLoading(false); // Still loaded, just not admin (due to error)
          logger.log('Error checking admin status, setting isLoading false.');
        }
      }
    };

    // Decision logic:
    // 1. If we have a user object AND we are still in the initial loading phase:
    //    This is the primary case after onAuthStateChange confirms a user. Check admin status.
    if (user && isLoading) {
      verifyAdminStatus(user.id);
    }
    // 2. If we DON'T have a user object AND we are NOT loading anymore:
    //    This means either initial check found no user, or user logged out. Ensure isAdmin is false.
    //    (onAuthStateChange handles setting isLoading=false in these cases)
    else if (!user && !isLoading) {
      if (isActive && isAdmin) { // Only change if it was previously true
         setIsAdmin(false);
         logger.log('User is null and not loading, ensuring isAdmin is false.');
      }
    }
    // 3. If we DON'T have a user object BUT we ARE still loading:
    //    Initial check is still running. Do nothing, wait for onAuthStateChange.
    else if (!user && isLoading) {
       logger.log('Initial load/check in progress, user not yet determined.');
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
        if (!isMounted.current) return;
        
        logger.log(`Auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        
        let userChanged = false; // Track if user actually changed
        
        if (currentSession) {
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
           setIsLoading(false);
           logger.log('Initial session check found no user, setting isLoading false.');
        }
        
        // The INITIAL_SESSION event marks the end of Supabase's initial check.
        // If there IS a session, the admin check effect will handle setting isLoading=false.
        // If there's NO session (handled above), isLoading is already set to false.
      }
    );

    // Initial check for session (helps ensure state before listener fires)
    supabase.auth.getSession().then(({ data: { session: initialSess } }) => {
      if (!isMounted.current) return;
      if (!session && initialSess) { // Only set if not already set by listener
         logger.log('Setting initial session data proactively');
         setUser(initialSess.user);
         setSession(initialSess);
         // Don't set isLoading false here, let the effects handle it
      } else if (!initialSess && isLoading) {
         // If getSession returns no session and we haven't heard from listener yet
         // it's likely there's no session.
         // Let the INITIAL_SESSION event in the listener handle setting isLoading=false
      }
    });

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
      logger.log('Cleaning up auth provider');
      isMounted.current = false;
      subscription.unsubscribe();
      clearInterval(refreshIntervalId);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
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
    } finally {
      // REMOVED: if (isMounted.current) { setIsLoading(false); }
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear auth state - handled by listener now more reliably
      // setUser(null);
      // setSession(null);
      // setIsAdmin(false);
    } catch (error: any) {
      toast.error(error.message || 'Error signing out');
      logger.error('Sign out error:', error);
    } finally {
       // REMOVED: if (isMounted.current) { setIsLoading(false); }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
