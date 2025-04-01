
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
  const refreshInterval = 3 * 60 * 1000; // 3 minutes (further reduced from 5 minutes)
  
  useEffect(() => {
    return () => {
      if (authTimeout.current) {
        clearTimeout(authTimeout.current);
        authTimeout.current = null;
      }
      isMounted.current = false;
    };
  }, []);

  // Setup even more frequent session refresh to prevent aggressive sign-outs
  useEffect(() => {
    if (!session) return;
    
    const refreshSession = async () => {
      const now = Date.now();
      if (now - lastTokenRefresh.current < refreshInterval) return;
      
      try {
        logger.log('Refreshing session token');
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          logger.error('Failed to refresh session:', error);
          return;
        }
        
        lastTokenRefresh.current = Date.now();
        
        // Only update if we got a valid session back to prevent unnecessary state changes
        if (data.session && isMounted.current) {
          logger.log('Session refreshed successfully');
          setSession(data.session);
          setUser(data.session.user);
        }
      } catch (error) {
        logger.error('Failed to refresh session:', error);
      }
    };
    
    // Initial refresh
    refreshSession();
    
    // Set up interval for refreshing - even more frequently
    const interval = setInterval(refreshSession, refreshInterval / 3);
    
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

    // Set up the auth state listener FIRST before checking for an existing session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession) => {
        logger.log(`Auth state changed: ${event}`, newSession?.user?.id || 'no user');
        authStateChangeHandled.current = true;
        
        if (!isMounted.current) return;
        
        switch (event) {
          case 'INITIAL_SESSION':
            // Handle initial session event
            if (newSession) {
              updateAuthState(newSession);
            }
            break;
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
          case 'USER_UPDATED':
            if (newSession) {
              updateAuthState(newSession);
            }
            break;
          default:
            // Don't log out on other events
            if (newSession) {
              updateAuthState(newSession);
            }
            logger.log(`Other auth event: ${event}`);
        }
      }
    );

    // Wait a tiny bit to let the auth state change listener initialize
    setTimeout(() => {
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
              // Refresh token immediately to extend session lifetime
              logger.log('Refreshing session token immediately');
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              
              if (refreshError) {
                logger.error('Error refreshing session:', refreshError);
              } else if (refreshData.session) {
                logger.log('Session refreshed successfully on initial load');
                updateAuthState(refreshData.session);
                lastTokenRefresh.current = Date.now();
              }
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
      if (!authStateChangeHandled.current && isMounted.current) {
        checkSession();
      }
    }, 50); // Small delay to ensure event listener is set up first

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
