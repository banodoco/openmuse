
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
  const authCheckComplete = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any existing timer when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    logger.log('Setting up auth listeners');
    let isActive = true;
    
    // Set a sensible timeout to prevent hanging
    timerRef.current = setTimeout(() => {
      if (isActive && isLoading && !authCheckComplete.current) {
        logger.warn('Auth check timed out, ensuring we complete loading state');
        if (isActive) {
          setIsLoading(false);
          authCheckComplete.current = true;
        }
      }
    }, 8000); // 8 seconds should be plenty

    // Set up auth state change listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        logger.log(`Auth state changed: ${event}`, newSession?.user?.id);
        
        if (!isActive) return;
        
        if (newSession) {
          logger.log(`Storing session data for user: ${newSession.user.id}`);
          logger.log(`User signed in, session is present: ${Boolean(newSession)}`);
          setUser(newSession.user);
          setSession(newSession);
        } else if (event === 'SIGNED_OUT') {
          logger.log('User signed out, clearing session');
          setUser(null);
          setSession(null);
        }
        
        // Don't complete loading state on initial events since we're still checking session
        if (event !== 'INITIAL_SESSION') {
          setIsLoading(false);
          authCheckComplete.current = true;
        }
      }
    );

    // THEN check for existing session
    const checkSession = async () => {
      try {
        logger.log('Checking existing session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (isActive) {
          if (data.session) {
            logger.log(`Session check complete, has session: ${Boolean(data.session)} ${data.session.user.id}`);
            setUser(data.session.user);
            setSession(data.session);
            
            // After setting session, try to refresh it for longer session life
            logger.log('Attempting to refresh existing session');
            try {
              const { data: refreshData } = await supabase.auth.refreshSession();
              if (refreshData.session) {
                logger.log(`Session refreshed successfully: ${refreshData.session.user.id}`);
              }
            } catch (refreshError) {
              logger.error('Error refreshing session:', refreshError);
            }
          } else {
            logger.log('No existing session found');
            setUser(null);
            setSession(null);
          }
          
          // Complete the loading state
          setIsLoading(false);
          authCheckComplete.current = true;
        }
      } catch (error: any) {
        logger.error('Error checking session:', error);
        if (isActive) {
          setIsLoading(false);
          authCheckComplete.current = true;
        }
      } finally {
        // Clear the timeout since we finished checking
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    checkSession();

    return () => {
      isActive = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      subscription.unsubscribe();
      logger.log('Auth listeners cleaned up');
    };
  }, [isLoading]);

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
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (error: any) {
      toast.error(error.message || 'Error signing out');
      logger.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
