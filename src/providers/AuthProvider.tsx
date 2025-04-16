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
  logger.log('--- AuthProvider Module Execution (Persistent Session v2 with Debug - Robust Loading) ---');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const userRef = useRef<User | null>(null);

  const isMounted = useRef(true);
  const initialCheckCompleted = useRef(false);
  const adminCheckInProgress = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    logger.log(`[${loadingCount}] Setting up persistent auth provider effect`);
    isMounted.current = true;
    initialCheckCompleted.current = false;

    const checkInitialSessionAndAdmin = async () => {
      if (initialCheckCompleted.current) {
          logger.log(`[${loadingCount}] Initial check already completed, skipping.`);
          return;
      }
      
      try {
        logger.log(`[${loadingCount}] Checking for existing persistent session`);
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          logger.warn(`[${loadingCount}] getSession() returned an error:`, error);
        } else {
          logger.log(`[${loadingCount}] getSession() returned data:`, {
            hasSession: !!data.session,
            userId: data.session?.user?.id,
            tokenExpires: data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null,
          });
        }

        if (!isMounted.current) return;

        if (data.session) {
          logger.log(`[${loadingCount}] Persistent session found:`, data.session.user.id);
          setSession(data.session);
          setUser(data.session.user);

          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[${loadingCount}] Starting admin check for user:`, data.session.user.id);
            try {
              const adminStatus = await checkIsAdmin(data.session.user.id);
               if (!isMounted.current) return;
              logger.log(`[${loadingCount}] Admin check result for ${data.session.user.id}:`, adminStatus);
              setIsAdmin(adminStatus);
            } catch (adminError) {
              if (!isMounted.current) return;
              logger.error(`[${loadingCount}] Error checking admin status:`, adminError);
              setIsAdmin(false);
            } finally {
               if (isMounted.current) {
                 adminCheckInProgress.current = false;
               }
            }
          }
        } else {
          logger.log(`[${loadingCount}] No persistent session found initially`);
           setSession(null);
           setUser(null);
           setIsAdmin(false);
        }
      } catch (error) {
        logger.error(`[${loadingCount}] Unexpected error during initial session check:`, error);
        if (isMounted.current) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      } finally {
        if (isMounted.current && !initialCheckCompleted.current) {
          logger.log(`[${loadingCount}] Initial session & admin check completed.`);
          initialCheckCompleted.current = true;
          setIsLoading(false);
          setLoadingCount(prev => prev + 1);
        }
      }
    };

    logger.log(`[${loadingCount}] Setting up auth state change listener`);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        if (!initialCheckCompleted.current) {
          if (event === 'SIGNED_OUT') {
            logger.log(`[${loadingCount}] Initial check not complete but received SIGNED_OUT, updating state as logged out.`);
            initialCheckCompleted.current = true;
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setIsLoading(false);
          } else if (event === 'SIGNED_IN') {
            logger.log(`[${loadingCount}] Initial check not complete but received SIGNED_IN, updating state with new session.`);
            initialCheckCompleted.current = true;
            setSession(currentSession);
            const newUser = currentSession?.user || null;
            setUser(newUser);
            if (newUser) {
              try {
                const adminStatus = await checkIsAdmin(newUser.id);
                setIsAdmin(adminStatus);
              } catch (adminError) {
                logger.error(`[${loadingCount}] Error during admin check in initial SIGNED_IN event:`, adminError);
                setIsAdmin(false);
              }
            } else {
              setIsAdmin(false);
            }
            setIsLoading(false);
          } else {
            logger.log(`[${loadingCount}] Initial check not complete, ignoring auth state change event: ${event}`);
            return;
          }
        }

        logger.log(`[${loadingCount}] Persistent auth state changed: ${event}`, currentSession?.user?.id || 'no user');
        console.log('[AuthProvider] Raw onAuthStateChange event:', event);
        console.log('[AuthProvider] Raw onAuthStateChange session object:', currentSession);

        const newUser = currentSession?.user || null;
        if (newUser && userRef.current && newUser.id === userRef.current.id) {
          logger.log(`[${loadingCount}] Auth state change: user unchanged, skipping update.`);
          return;
        }

        if (!isMounted.current) {
          logger.log(`[${loadingCount}] Component not mounted, ignoring auth state change`);
          return;
        }

        setSession(currentSession);
        setUser(newUser);

        if (!newUser) {
          logger.log(`[${loadingCount}] Auth state change: No session/user. Resetting admin status.`);
          setIsAdmin(false);
        } else {
          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[${loadingCount}] Starting admin check for user after auth change:`, newUser.id);
            try {
              const adminStatus = await checkIsAdmin(newUser.id);
              if (!isMounted.current) return;
              logger.log(`[${loadingCount}] Admin check result after auth change:`, adminStatus);
              setIsAdmin(adminStatus);
            } catch (adminError) {
              if (!isMounted.current) return;
              logger.error(`[${loadingCount}] Error checking admin status after auth change:`, adminError);
              setIsAdmin(false);
            } finally {
              if (isMounted.current) {
                adminCheckInProgress.current = false;
              }
            }
          }
        }

        setLoadingCount(prev => prev + 1);
      }
    );

    checkInitialSessionAndAdmin();

    return () => {
      logger.log(`[${loadingCount}] Cleaning up auth provider effect and subscription`);
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
    } catch (error: any) {
      toast.dismiss('signout-toast');
      toast.error(error.message || 'Error signing out');
      logger.error(`[${loadingCount}] Sign out error:`, error);
    }
  };

  logger.log(`[${loadingCount}] AuthProvider rendering. State: isLoading=${isLoading}, user=${!!user}, session=${!!session}, isAdmin=${isAdmin}`);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        isAdmin, 
        isLoading, 
        signIn, 
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
