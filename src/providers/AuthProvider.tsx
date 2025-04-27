import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { checkIsAdmin } from '@/lib/auth';
import { userProfileCache } from '@/lib/auth/cache';

const logger = new Logger('AuthProvider');
logger.log('--- AuthProvider Module Initial Load ---'); // Log when the module itself is first processed

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  logger.log('AuthProvider component mounting');

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // START LOADING TRUE: Assume loading until initial check completes
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const userRef = useRef<User | null>(null);

  const isMounted = useRef(true);
  const initialCheckCompleted = useRef(false);
  const adminCheckInProgress = useRef(false);

  useEffect(() => {
    userRef.current = user;
    logger.log('[Ref Update] User state updated in ref:', user?.id || 'null');
  }, [user]);

  useEffect(() => {
    logger.log('[Effect Setup] AuthProvider effect setup starting');
    isMounted.current = true;
    initialCheckCompleted.current = false; // Reset on effect setup

    const checkInitialSessionAndAdmin = async () => {
      logger.log('[Initial Check] START');
      if (initialCheckCompleted.current) {
          logger.log('[Initial Check] Already completed, skipping.');
          // Still set loading false if it hasn't been set yet
          if (isLoading) setIsLoading(false);
          return;
      }

      try {
        logger.log('[Initial Check] Calling supabase.auth.getSession()');
        // Explicitly set loading true here *before* the async call
        // Although initialized to true, this ensures it's true if the effect re-runs
        setIsLoading(true);
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted.current) {
          logger.log('[Initial Check] Component unmounted during getSession, aborting.');
          return;
        }

        if (error) {
          logger.warn('[Initial Check] getSession() error:', error);
          // Treat error as no session
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        } else if (data.session) {
          logger.log(`[Initial Check] Session FOUND - User ID: ${data.session.user.id}`);
          setSession(data.session);
          setUser(data.session.user);

          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[Initial Check] Starting admin check for user: ${data.session.user.id}`);
            try {
              const adminStatus = await checkIsAdmin(data.session.user.id);
               if (!isMounted.current) {
                 logger.log('[Initial Check] Component unmounted during admin check, aborting status update.');
                 adminCheckInProgress.current = false; // Reset flag if aborting
                 return;
               }
              logger.log(`[Initial Check] Admin check result for ${data.session.user.id}: ${adminStatus}`);
              setIsAdmin(adminStatus);
            } catch (adminError) {
              logger.error('[Initial Check] Error checking admin status:', adminError);
              if (isMounted.current) setIsAdmin(false); // Set admin false on error if still mounted
            } finally {
               if (isMounted.current) {
                 logger.log('[Initial Check] Admin check finished.');
                 adminCheckInProgress.current = false;
               } else {
                 logger.log('[Initial Check] Admin check finished, but component unmounted.');
               }
            }
          } else {
            logger.log('[Initial Check] Admin check already in progress, skipping.');
          }
        } else {
          logger.log('[Initial Check] No session found.');
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      } catch (error) {
        logger.error('[Initial Check] Unexpected error:', error);
        if (isMounted.current) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      } finally {
        if (isMounted.current) {
          logger.log('[Initial Check] FINALLY block executing.');
          if (!initialCheckCompleted.current) {
            logger.log('[Initial Check] Marking initial check as COMPLETED.');
            initialCheckCompleted.current = true;
          }
          // Crucially, set loading to false *after* all checks/updates are done
          logger.log('[Initial Check] Setting isLoading to FALSE.');
          setIsLoading(false);
        } else {
           logger.log('[Initial Check] FINALLY block, component unmounted.');
        }
      }
    };

    logger.log('[Effect Setup] Setting up onAuthStateChange listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        logger.log(`[Auth Listener] Event received: ${event}, User: ${currentSession?.user?.id || 'none'}`);

        // Let initial check run fully before processing listener events fully
        // However, if the initial check hasn't completed and we get a definitive sign-out,
        // we can potentially short-circuit and mark as complete & logged out.
        if (!initialCheckCompleted.current) {
           if (event === 'SIGNED_OUT' && !session) { // Only if we don't have a session from getSession yet
             logger.log(`[Auth Listener] Initial check not complete, but definitive SIGNED_OUT received. Updating state.`);
             if (isMounted.current) {
               setSession(null);
               setUser(null);
               setIsAdmin(false);
               // Mark initial check complete and set loading false
               initialCheckCompleted.current = true;
               setIsLoading(false);
             }
             return; // Don't process further in this case
           } else {
             logger.log(`[Auth Listener] Initial check not yet complete, deferring full processing of event: ${event}`);
             // It might be useful to still update the session/user optimistically here if SIGNED_IN
             // but wait for the initial check to finish before setting isLoading=false or checking admin
             if (event === 'SIGNED_IN' && currentSession) {
                logger.log(`[Auth Listener] Optimistically setting session/user for deferred SIGNED_IN.`);
                setSession(currentSession);
                setUser(currentSession.user);
                // DO NOT set isAdmin or isLoading here yet
             }
             return; // Wait for initial check to complete fully
           }
        }

        // If initial check is complete, process normally
        logger.log(`[Auth Listener] Processing event ${event} (initial check complete)`);

        // --- Username Sync Check ---
        if (currentSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          const userId = currentSession.user.id;
          // Get Discord info from metadata
          const discordUsername = currentSession.user.user_metadata?.preferred_username;
          const discordUserId = currentSession.user.user_metadata?.provider_id;

          if (discordUsername || discordUserId) { // Check if we have either username or ID from Discord
            logger.log(`[Auth Listener] Checking Discord ID/Username sync for user ${userId}`);
            try {
              // Fetch only the discord fields from the profile
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('discord_user_id, discord_username') // Only select discord fields
                .eq('id', userId)
                .maybeSingle();

              if (profileError) {
                logger.error(`[Auth Listener] Error fetching profile for Discord sync for user ${userId}:`, profileError);
              } else if (profileData) {
                // Determine if an update is needed ONLY for discord fields
                const updatePayload: { discord_user_id?: string; discord_username?: string } = {};
                let needsUpdate = false;

                // Sync discord_username
                if (discordUsername && profileData.discord_username !== discordUsername) {
                  logger.log(`[Auth Listener] Discord username sync needed for ${userId}. DB: "${profileData.discord_username}", Discord: "${discordUsername}".`);
                  updatePayload.discord_username = discordUsername;
                  needsUpdate = true;
                }

                // Sync discord_user_id
                if (discordUserId && profileData.discord_user_id !== discordUserId) {
                   logger.log(`[Auth Listener] Discord user ID sync needed for ${userId}. DB: "${profileData.discord_user_id}", Discord: "${discordUserId}".`);
                  updatePayload.discord_user_id = discordUserId;
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  logger.log(`[Auth Listener] Updating profile for ${userId} with Discord fields:`, updatePayload);
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update(updatePayload) // Only update discord fields
                    .eq('id', userId);

                  if (updateError) {
                    logger.error(`[Auth Listener] Error updating profile with Discord fields for ${userId}:`, updateError);
                  } else {
                    logger.log(`[Auth Listener] Successfully updated Discord fields for ${userId}. Clearing profile cache.`);
                    userProfileCache.delete(userId); // Invalidate cache as profile data changed
                  }
                } else {
                   logger.log(`[Auth Listener] Discord fields for ${userId} (Username: '${profileData.discord_username}', ID: '${profileData.discord_user_id}') are already in sync.`);
                }

              } else if (!profileData) {
                logger.warn(`[Auth Listener] Profile not found for user ${userId} during Discord sync check. Cannot update Discord fields.`);
              }
            } catch (syncError) {
              logger.error(`[Auth Listener] Unexpected error during Discord sync check for ${userId}:`, syncError);
            }
          } else {
            logger.log(`[Auth Listener] No Discord username or provider_id found in metadata for ${userId}, skipping sync check.`);
          }
        }
        // --- End Username Sync Check ---

        if (!isMounted.current) {
          logger.log('[Auth Listener] Component unmounted, ignoring event.');
          return;
        }

        // --- State Update Logic ---
        const newUser = currentSession?.user || null;
        const oldUser = userRef.current; // Get user from ref *before* potential update

        // Update session and user state
        // Use functional updates if depending on previous state might be relevant, though direct set is often fine here
        logger.log(`[Auth Listener] Setting session and user. New User ID: ${newUser?.id || 'null'}`);
        setSession(currentSession);
        setUser(newUser); // This triggers the userRef update effect

        // --- Admin Check Logic ---
        if (!newUser) {
          logger.log('[Auth Listener] No user in session, resetting admin status.');
          setIsAdmin(false);
        } else if (newUser.id !== oldUser?.id) { // Only check admin if the user *actually changed*
          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[Auth Listener] User changed (${oldUser?.id} -> ${newUser.id}). Starting admin check.`);
            try {
              const adminStatus = await checkIsAdmin(newUser.id);
              if (!isMounted.current) {
                 logger.log('[Auth Listener] Component unmounted during admin check, aborting status update.');
                 adminCheckInProgress.current = false;
                 return;
              }
              logger.log(`[Auth Listener] Admin check result for ${newUser.id}: ${adminStatus}`);
              setIsAdmin(adminStatus);
            } catch (adminError) {
              logger.error('[Auth Listener] Error checking admin status:', adminError);
              if (isMounted.current) setIsAdmin(false);
            } finally {
               if (isMounted.current) {
                 logger.log('[Auth Listener] Admin check finished.');
                 adminCheckInProgress.current = false;
               } else {
                 logger.log('[Auth Listener] Admin check finished, but component unmounted.');
               }
            }
          } else {
            logger.log(`[Auth Listener] Admin check already in progress for user ${newUser.id}, skipping new check.`);
          }
        } else {
           logger.log(`[Auth Listener] User unchanged (${newUser.id}), skipping admin check.`);
           // Ensure isAdmin state is still correct if somehow diverged (edge case)
           if (isAdmin === undefined && !adminCheckInProgress.current) {
             logger.warn(`[Auth Listener] User unchanged but isAdmin is undefined, attempting re-check.`);
             // Simplified re-check logic (consider reusing above block if complex)
             adminCheckInProgress.current = true;
             checkIsAdmin(newUser.id).then(status => {
               if(isMounted.current) setIsAdmin(status);
             }).catch(err => {
               logger.error('[Auth Listener] Error in admin re-check:', err);
               if(isMounted.current) setIsAdmin(false);
             }).finally(() => {
               if(isMounted.current) adminCheckInProgress.current = false;
             });
           }
        }
        // Ensure loading is false after processing an event post-initial check
        logger.log('[Auth Listener] Setting isLoading to FALSE after processing event.');
        setIsLoading(false);
      }
    );

    // Initial check invocation
    logger.log('[Effect Setup] Invoking checkInitialSessionAndAdmin');
    checkInitialSessionAndAdmin();

    // Cleanup function
    return () => {
      logger.log('[Effect Cleanup] Unsubscribing and setting isMounted=false');
      isMounted.current = false;
      subscription.unsubscribe();
      // Cancel any ongoing admin check? Maybe not necessary if checks handle isMounted.current
    };
  // IMPORTANT: Minimal dependencies. This effect should run essentially once on mount.
  // Adding dependencies like `isLoading` can cause infinite loops.
  }, []);

  // Sign-in function
  const signIn = async (email: string, password: string) => {
     logger.log(`[Auth Action] signIn: Attempting for email: ${email}`);
    try {
      toast.loading('Signing in...', { id: 'signin-toast' });
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      toast.dismiss('signin-toast');

      if (error) {
        logger.error(`[Auth Action] signIn: Error for ${email}:`, error);
        throw error;
      }
      
      logger.log(`[Auth Action] signIn: Successful for ${email}`);
    } catch (error: any) {
      toast.dismiss('signin-toast');
      toast.error(error.message || 'Error signing in');
      logger.error(`[Auth Action] signIn: Error for ${email}:`, error);
    }
  };

  // Sign-out function
  const signOut = async () => {
    logger.log(`[Auth Action] signOut: Attempting sign out`);
    try {
      toast.loading('Signing out...', { id: 'signout-toast' });
      await supabase.auth.signOut();
      toast.dismiss('signout-toast');
      logger.log(`[Auth Action] signOut: Successful`);
    } catch (error: any) {
      toast.dismiss('signout-toast');
      toast.error(error.message || 'Error signing out');
      logger.error(`[Auth Action] signOut: Error:`, error);
    }
  };

  logger.log(`[Render] AuthProvider rendering. State: isLoading=${isLoading}, user=${user?.id || 'null'}, session=${!!session}, isAdmin=${isAdmin}`);

  // Provide the context value
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        isLoading, // Pass the dynamic loading state
        signIn,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
