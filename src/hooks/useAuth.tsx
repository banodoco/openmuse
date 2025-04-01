
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
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        }
        
        // Don't change loading state here to avoid premature completion
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
          
          // Also do an immediate token refresh to extend session lifetime
          try {
            await supabase.auth.refreshSession();
          } catch (refreshError) {
            logger.error('Error refreshing session on initial load:', refreshError);
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

    // Set up session refresh on interval (simple approach)
    const refreshIntervalId = setInterval(async () => {
      if (!isMounted.current || !session) return;
      
      try {
        logger.log('Refreshing session token');
        await supabase.auth.refreshSession();
      } catch (error) {
        logger.error('Error in session refresh interval:', error);
      }
    }, 4 * 60 * 1000); // Every 4 minutes
    
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
