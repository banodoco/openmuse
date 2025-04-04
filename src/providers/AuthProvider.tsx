
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
  logger.log('--- AuthProvider Module Execution (Persistent Session v2 with Debug) ---');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loadingCount, setLoadingCount] = useState(0);

  const isMounted = useRef(true);
  const initialSessionCheckComplete = useRef(false);
  const adminCheckInProgress = useRef(false);

  useEffect(() => {
    logger.log('Setting up persistent auth provider with enhanced logging');
    isMounted.current = true;
    initialSessionCheckComplete.current = false;

    // Immediately check for an existing session when the component mounts
    const checkInitialSession = async () => {
      try {
        logger.log(`[${loadingCount}] Checking for existing persistent session`);
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error(`[${loadingCount}] Error getting initial session:`, error);
          setIsInitialLoading(false);
          initialSessionCheckComplete.current = true;
          return;
        }
        
        if (data.session) {
          logger.log(`[${loadingCount}] Persistent session found:`, data.session.user.id);
          setSession(data.session);
          setUser(data.session.user);
          
          // Check admin status
          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[${loadingCount}] Starting admin check for user:`, data.session.user.id);
            
            try {
              const adminStatus = await checkIsAdmin(data.session.user.id);
              logger.log(`[${loadingCount}] Admin check result for ${data.session.user.id}:`, adminStatus);
              setIsAdmin(adminStatus);
            } catch (adminError) {
              logger.error(`[${loadingCount}] Error checking admin status:`, adminError);
              setIsAdmin(false);
            } finally {
              adminCheckInProgress.current = false;
            }
          }
        } else {
          logger.log(`[${loadingCount}] No persistent session found`);
        }
        
        logger.log(`[${loadingCount}] Initial session check completed`);
        setIsInitialLoading(false);
        initialSessionCheckComplete.current = true;
      } catch (error) {
        logger.error(`[${loadingCount}] Unexpected error during initial session check:`, error);
        setIsInitialLoading(false);
        initialSessionCheckComplete.current = true;
      }
      
      setLoadingCount(prev => prev + 1);
    };
    
    // Set up auth state change listener
    logger.log(`[${loadingCount}] Setting up auth state change listener`);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        logger.log(`[${loadingCount}] Persistent auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        
        if (!isMounted.current) {
          logger.log(`[${loadingCount}] Component not mounted, ignoring auth state change`);
          return;
        }
        
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Check admin status
          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[${loadingCount}] Starting admin check for user after auth change:`, currentSession.user.id);
            
            try {
              const adminStatus = await checkIsAdmin(currentSession.user.id);
              logger.log(`[${loadingCount}] Admin check result after auth change:`, adminStatus);
              setIsAdmin(adminStatus);
            } catch (adminError) {
              logger.error(`[${loadingCount}] Error checking admin status after auth change:`, adminError);
              setIsAdmin(false);
            } finally {
              adminCheckInProgress.current = false;
            }
          }
        } else {
          logger.log(`[${loadingCount}] Auth state change: No session`);
          setUser(null);
          setSession(null);
          setIsAdmin(false);
        }
        
        if (isInitialLoading && initialSessionCheckComplete.current) {
          logger.log(`[${loadingCount}] Finishing initial loading after auth state change`);
          setIsInitialLoading(false);
        }
        
        setLoadingCount(prev => prev + 1);
      }
    );

    // Start the initial session check after setting up the listener
    checkInitialSession();

    return () => {
      logger.log(`[${loadingCount}] Cleaning up auth provider subscription`);
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      logger.log(`[${loadingCount}] Starting sign in process for email: ${email}`);
      toast.loading('Signing in...', { id: 'signin-toast' }); 
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      toast.dismiss('signin-toast');

      if (error) {
        logger.error(`[${loadingCount}] Sign in error:`, error);
        throw error;
      }
      
      logger.log(`[${loadingCount}] Sign in successful for: ${email}`);
      setLoadingCount(prev => prev + 1);
    } catch (error: any) {
      toast.dismiss('signin-toast');
      toast.error(error.message || 'Error signing in');
      logger.error(`[${loadingCount}] Sign in error:`, error);
    }
  };

  const signOut = async () => {
    try {
      logger.log(`[${loadingCount}] Starting sign out process`);
      toast.loading('Signing out...', { id: 'signout-toast' });
      await supabase.auth.signOut();
      toast.dismiss('signout-toast');
      logger.log(`[${loadingCount}] Sign out successful`);
      setLoadingCount(prev => prev + 1);
    } catch (error: any) {
      toast.dismiss('signout-toast');
      toast.error(error.message || 'Error signing out');
      logger.error(`[${loadingCount}] Sign out error:`, error);
    }
  };

  // Combine loading states
  const combinedIsLoading = isInitialLoading || !initialSessionCheckComplete.current;

  logger.log(`[${loadingCount}] AuthProvider State: isLoading=${combinedIsLoading}, user=${!!user}, session=${!!session}, isAdmin=${isAdmin}`);

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
