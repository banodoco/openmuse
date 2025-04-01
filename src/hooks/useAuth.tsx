
import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';

const logger = new Logger('useAuth');

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);
  const authStateChangeHandled = useRef(false);
  const initialSessionCheckComplete = useRef(false);
  const authTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastTokenRefresh = useRef<number>(0);
  const refreshInterval = 10 * 60 * 1000; // 10 minutes
  
  useEffect(() => {
    return () => {
      if (authTimeout.current) {
        clearTimeout(authTimeout.current);
        authTimeout.current = null;
      }
      isMounted.current = false;
    };
  }, []);

  // Setup periodic session refresh to prevent aggressive sign-outs
  useEffect(() => {
    if (!session) return;
    
    const refreshSession = async () => {
      const now = Date.now();
      if (now - lastTokenRefresh.current < refreshInterval) return;
      
      try {
        logger.log('Refreshing session token');
        const { data } = await supabase.auth.refreshSession();
        lastTokenRefresh.current = Date.now();
        
        // Only update if we got a valid session back to prevent unnecessary state changes
        if (data.session && isMounted.current) {
          logger.log('Session refreshed successfully');
        }
      } catch (error) {
        logger.error('Failed to refresh session:', error);
      }
    };
    
    // Initial refresh
    refreshSession();
    
    // Set up interval for refreshing
    const interval = setInterval(refreshSession, refreshInterval / 2);
    
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    logger.log('Setting up auth provider');
    
    authTimeout.current = setTimeout(() => {
      if (isMounted.current && isLoading && !initialSessionCheckComplete.current) {
        logger.warn('Auth check timed out after 3 seconds, completing loading state');
        setIsLoading(false);
        initialSessionCheckComplete.current = true;
      }
    }, 3000);

    const updateAuthState = (newSession: Session | null) => {
      if (!isMounted.current) return;
      
      if (newSession) {
        logger.log(`Session updated: ${newSession.user.id}`);
        setUser(newSession.user);
        setSession(newSession);
        lastTokenRefresh.current = Date.now();
      } else {
        logger.log('No session available, clearing user data');
        setUser(null);
        setSession(null);
      }
      
      if (!initialSessionCheckComplete.current) {
        setIsLoading(false);
        initialSessionCheckComplete.current = true;
        
        if (authTimeout.current) {
          clearTimeout(authTimeout.current);
          authTimeout.current = null;
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession) => {
        logger.log(`Auth state changed: ${event}`, newSession?.user?.id || 'no user');
        authStateChangeHandled.current = true;
        
        if (!isMounted.current) return;
        
        switch (event) {
          case 'SIGNED_IN':
            updateAuthState(newSession);
            break;
          case 'TOKEN_REFRESHED':
            // Only update if we actually have a valid session
            if (newSession) {
              updateAuthState(newSession);
              lastTokenRefresh.current = Date.now();
            }
            break;
          case 'SIGNED_OUT':
            updateAuthState(null);
            break;
          case 'PASSWORD_RECOVERY':
          case 'USER_UPDATED':
          case 'MFA_CHALLENGE_VERIFIED':
            if (newSession) {
              updateAuthState(newSession);
            }
            break;
          default:
            logger.log(`Unhandled auth event: ${event}`);
        }
      }
    );

    const checkSession = async () => {
      try {
        if (!isMounted.current) return;
        
        logger.log('Checking for existing session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error getting session:', error);
          throw error;
        }
        
        if (data.session) {
          logger.log(`Found existing session: ${data.session.user.id}`);
          updateAuthState(data.session);
          
          try {
            // Don't automatically refresh on initial load to avoid potential race conditions
            // The periodic refresh mechanism will handle it shortly after
            logger.log('Session found, token refresh will happen on next interval');
            lastTokenRefresh.current = Date.now() - (refreshInterval / 2); // Refresh halfway through the interval
          } catch (refreshError) {
            logger.error('Error refreshing session:', refreshError);
          }
        } else {
          logger.log('No existing session found');
          updateAuthState(null);
        }
      } catch (error) {
        logger.error('Session check failed:', error);
        if (isMounted.current) {
          setIsLoading(false);
          initialSessionCheckComplete.current = true;
        }
      }
    };

    // Only check session if auth state change hasn't been handled yet
    // This prevents unnecessary duplicate session checks
    setTimeout(() => {
      if (!authStateChangeHandled.current && isMounted.current) {
        checkSession();
      }
    }, 100);

    return () => {
      isMounted.current = false;
      if (authTimeout.current) {
        clearTimeout(authTimeout.current);
        authTimeout.current = null;
      }
      subscription.unsubscribe();
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
        lastTokenRefresh.current = Date.now();
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
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
