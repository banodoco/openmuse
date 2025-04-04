
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { checkIsAdmin } from '@/lib/auth';

const logger = new Logger('AuthProvider');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Log version to help with debugging
  logger.log('--- AuthProvider Module Execution (Persistent Session v1) ---');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const isMounted = useRef(true);
  const initialSessionCheckComplete = useRef(false);

  useEffect(() => {
    logger.log('Setting up persistent auth provider');
    isMounted.current = true;
    initialSessionCheckComplete.current = false;

    // Immediately check for an existing session when the component mounts
    const checkInitialSession = async () => {
      try {
        logger.log('Checking for existing persistent session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error getting initial session:', error);
          setIsInitialLoading(false);
          initialSessionCheckComplete.current = true;
          return;
        }
        
        if (data.session) {
          logger.log('Persistent session found:', data.session.user.id);
          setSession(data.session);
          setUser(data.session.user);
        } else {
          logger.log('No persistent session found');
        }
        
        setIsInitialLoading(false);
        initialSessionCheckComplete.current = true;
      } catch (error) {
        logger.error('Unexpected error during initial session check:', error);
        setIsInitialLoading(false);
        initialSessionCheckComplete.current = true;
      }
    };
    
    checkInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, currentSession) => {
        logger.log(`Persistent auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        
        if (!isMounted.current) return;
        
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Check admin status
          checkIsAdmin(currentSession.user.id)
            .then(adminStatus => setIsAdmin(adminStatus))
            .catch(error => {
              logger.error('Error checking admin status:', error);
              setIsAdmin(false);
            });
        } else {
          setUser(null);
          setSession(null);
          setIsAdmin(false);
        }
        
        if (isInitialLoading && initialSessionCheckComplete.current) {
          setIsInitialLoading(false);
        }
      }
    );

    return () => {
      logger.log('Cleaning up auth provider subscription');
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      toast.loading('Signing in...', { id: 'signin-toast' }); 
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      toast.dismiss('signin-toast');

      if (error) throw error;
      
      logger.log('Sign in successful');
    } catch (error: any) {
      toast.dismiss('signin-toast');
      toast.error(error.message || 'Error signing in');
      logger.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      toast.loading('Signing out...', { id: 'signout-toast' });
      await supabase.auth.signOut();
      toast.dismiss('signout-toast');
      logger.log('Sign out successful');
    } catch (error: any) {
      toast.dismiss('signout-toast');
      toast.error(error.message || 'Error signing out');
      logger.error('Sign out error:', error);
    }
  };

  // Combine loading states
  const combinedIsLoading = isInitialLoading || !initialSessionCheckComplete.current;

  logger.log(`AuthProvider State: isLoading=${combinedIsLoading}, user=${!!user}, session=${!!session}, isAdmin=${isAdmin}`);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        isAdmin, 
        isLoading: combinedIsLoading, 
        signIn, 
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
