
import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
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
  const sessionCheckComplete = useRef(false);
  const authTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Clear any existing timers when component unmounts
  useEffect(() => {
    return () => {
      if (authTimeout.current) {
        clearTimeout(authTimeout.current);
        authTimeout.current = null;
      }
    };
  }, []);

  useEffect(() => {
    logger.log('Setting up auth provider');
    
    // Set a maximum timeout to prevent infinite loading state - reduced from 6s to 3s
    authTimeout.current = setTimeout(() => {
      if (isMounted.current && isLoading && !sessionCheckComplete.current) {
        logger.warn('Auth check timed out after 3 seconds, completing loading state');
        setIsLoading(false);
        sessionCheckComplete.current = true;
      }
    }, 3000);

    // Set up auth state change listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        logger.log(`Auth state changed: ${event}`, newSession?.user?.id || 'no user');
        
        if (!isMounted.current) return;
        
        if (newSession) {
          logger.log(`Session updated: ${newSession.user.id}`);
          setUser(newSession.user);
          setSession(newSession);
        } else if (event === 'SIGNED_OUT') {
          logger.log('User signed out, clearing session data');
          setUser(null);
          setSession(null);
        }
        
        // Don't mark loading as complete for initial session event
        if (event !== 'INITIAL_SESSION') {
          setIsLoading(false);
          sessionCheckComplete.current = true;
        }
      }
    );

    // THEN check for existing session
    const checkSession = async () => {
      try {
        if (!isMounted.current) return;
        
        logger.log('Checking for existing session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error getting session:', error);
          throw error;
        }
        
        if (isMounted.current) {
          if (data.session) {
            logger.log(`Found existing session: ${data.session.user.id}`);
            setUser(data.session.user);
            setSession(data.session);
            
            // Try to refresh the session in the background
            try {
              const { data: refreshData } = await supabase.auth.refreshSession();
              if (refreshData.session) {
                logger.log(`Session refreshed: ${refreshData.session.user.id}`);
              }
            } catch (refreshError) {
              logger.error('Error refreshing session:', refreshError);
            }
          } else {
            logger.log('No existing session found');
          }
          
          // Mark loading as complete
          setIsLoading(false);
          sessionCheckComplete.current = true;
        }
      } catch (error) {
        logger.error('Session check failed:', error);
        if (isMounted.current) {
          setIsLoading(false);
          sessionCheckComplete.current = true;
        }
      } finally {
        // Clear the timeout since we've completed
        if (authTimeout.current) {
          clearTimeout(authTimeout.current);
          authTimeout.current = null;
        }
      }
    };

    // Run the session check
    checkSession();

    // Clean up on unmount
    return () => {
      logger.log('Auth provider unmounting, cleaning up listeners');
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
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) throw error;
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
      const { error } = await supabase.auth.signOut();
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
