
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
  
  // Clear any existing timers when component unmounts
  useEffect(() => {
    return () => {
      if (authTimeout.current) {
        clearTimeout(authTimeout.current);
        authTimeout.current = null;
      }
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    logger.log('Setting up auth provider');
    
    // Set a maximum timeout to prevent infinite loading state
    authTimeout.current = setTimeout(() => {
      if (isMounted.current && isLoading && !initialSessionCheckComplete.current) {
        logger.warn('Auth check timed out after 3 seconds, completing loading state');
        setIsLoading(false);
        initialSessionCheckComplete.current = true;
      }
    }, 3000);

    // Function to update auth state safely
    const updateAuthState = (newSession: Session | null) => {
      if (!isMounted.current) return;
      
      if (newSession) {
        logger.log(`Session updated: ${newSession.user.id}`);
        setUser(newSession.user);
        setSession(newSession);
      } else {
        logger.log('No session available, clearing user data');
        setUser(null);
        setSession(null);
      }
      
      if (!initialSessionCheckComplete.current) {
        setIsLoading(false);
        initialSessionCheckComplete.current = true;
        
        // Clear the timeout since we've completed
        if (authTimeout.current) {
          clearTimeout(authTimeout.current);
          authTimeout.current = null;
        }
      }
    };

    // Set up auth state change listener with a stable reference
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession) => {
        logger.log(`Auth state changed: ${event}`, newSession?.user?.id || 'no user');
        authStateChangeHandled.current = true;
        
        if (!isMounted.current) return;
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          updateAuthState(newSession);
        } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          updateAuthState(null);
        }
      }
    );

    // Check for existing session if auth state change hasn't been handled
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
          
          // Refresh token in the background
          try {
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData.session && isMounted.current) {
              logger.log('Session refreshed successfully');
              updateAuthState(refreshData.session);
            }
          } catch (refreshError) {
            logger.error('Error refreshing session:', refreshError);
            // Continue with existing session
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

    // Wait briefly for auth state change before checking session directly
    // This helps prevent race conditions
    setTimeout(() => {
      if (!authStateChangeHandled.current && isMounted.current) {
        checkSession();
      }
    }, 100);

    // Clean up on unmount
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
      
      // Clear state immediately
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
