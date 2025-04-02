
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
  const refreshInProgress = useRef(false); // Track when refresh is happening
  const lastRefreshTime = useRef<number>(0);
  
  // Effect to check admin status whenever user changes
  useEffect(() => {
    let isActive = true;
    
    const verifyAdminStatus = async () => {
      if (!user) {
        if (isActive) setIsAdmin(false);
        return;
      }
      
      try {
        logger.log('Checking admin status for user:', user.id);
        const userIsAdmin = await checkIsAdmin(user.id);
        
        if (isActive) {
          setIsAdmin(userIsAdmin);
          logger.log(`User admin status: ${userIsAdmin ? 'is admin' : 'not admin'}`);
        }
      } catch (error) {
        logger.error('Error checking admin status:', error);
        if (isActive) setIsAdmin(false);
      }
    };
    
    verifyAdminStatus();
    
    return () => {
      isActive = false;
    };
  }, [user]);
  
  useEffect(() => {
    logger.log('Setting up auth provider');
    
    // Set up the auth state change listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, currentSession) => {
        if (!isMounted.current) return;
        
        logger.log(`Auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        
        if (currentSession) {
          setUser(currentSession.user);
          setSession(currentSession);
          
          // Don't check admin status here - the user effect will handle it
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session (with a small delay to ensure listener is set)
    const timeoutId = setTimeout(async () => {
      if (!isMounted.current) return;
      
      try {
        logger.log('Checking for existing session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (data.session) {
          logger.log(`Found existing session: ${data.session.user.id}`);
          setUser(data.session.user);
          setSession(data.session);
          
          // Don't check admin status here - the user effect will handle it
          
          // Store last refresh time
          lastRefreshTime.current = Date.now();
          
          // Also do an immediate token refresh to extend session lifetime
          try {
            refreshInProgress.current = true;
            await supabase.auth.refreshSession();
            logger.log('Session refreshed successfully');
            lastRefreshTime.current = Date.now();
          } catch (refreshError) {
            // Non-fatal, log but continue
            logger.error('Error refreshing session on initial load:', refreshError);
          } finally {
            refreshInProgress.current = false;
          }
        } else {
          logger.log('No existing session found');
        }
      } catch (error) {
        logger.error('Error checking session:', error);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    }, 100);

    // Set up session refresh on interval with better error handling and throttling
    const refreshIntervalId = setInterval(async () => {
      if (!isMounted.current || !session || refreshInProgress.current) return;
      
      // Only refresh if it's been at least 3 minutes since last refresh
      const now = Date.now();
      if (now - lastRefreshTime.current < 3 * 60 * 1000) {
        return;
      }
      
      try {
        logger.log('Refreshing session token');
        refreshInProgress.current = true;
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          logger.error('Failed to refresh session:', error);
          // Don't force logout here - let the next attempt try again
        } else if (data.session) {
          // Update session and user state with fresh values
          setSession(data.session);
          setUser(data.session.user);
          logger.log('Session refreshed successfully');
          lastRefreshTime.current = now;
        }
      } catch (error) {
        logger.error('Error in session refresh interval:', error);
      } finally {
        refreshInProgress.current = false;
      }
    }, 1 * 60 * 1000); // Check every minute but only refresh after 3+ minutes
    
    return () => {
      logger.log('Cleaning up auth provider');
      isMounted.current = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
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
        setUser(data.session.user);
        setSession(data.session);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error signing in');
      logger.error('Sign in error:', error);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut({
        scope: 'local'  // Only sign out from this tab, not all sessions
      });
      if (error) throw error;
      
      setUser(null);
      setSession(null);
      setIsAdmin(false);
    } catch (error: any) {
      toast.error(error.message || 'Error signing out');
      logger.error('Sign out error:', error);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
