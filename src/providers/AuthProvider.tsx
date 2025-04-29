import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { checkIsAdmin } from '@/lib/auth';
import { userProfileCache } from '@/lib/auth/cache';

const logger = new Logger('AuthProvider', true, 'SessionPersist');
const PROVIDER_VERSION = '1.3.0'; // Increment this on significant changes
logger.log(`--- AuthProvider Module Initial Load [v${PROVIDER_VERSION}] ---`); // Log when the module itself is first processed

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  logger.log(`AuthProvider component mounting [v${PROVIDER_VERSION}]`);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // START LOADING TRUE: Assume loading until initial check completes
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const userRef = useRef<User | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const isMounted = useRef(true);
  const initialCheckCompleted = useRef(false);
  const adminCheckInProgress = useRef(false);
  const sessionFallbackTimeout = useRef<NodeJS.Timeout | null>(null); // NEW REF

  /**
   * Safely update the isAdmin flag *only* if the component is still mounted **and**
   * the user has not changed since the async admin check was initiated.  Prevents
   * a race where an admin check for an old user finishes after a new user has
   * logged in (or the original user has logged out), which could otherwise
   * leave the `isAdmin` state in the wrong value for the current user.
   */
  const safeSetIsAdmin = (userId: string | null | undefined, value: boolean) => {
    // Handle null/undefined userId gracefully (e.g., if user becomes null)
    const currentUserId = userRef.current?.id;
    const checkUserId = userId || 'null_user_id_placeholder'; // Use placeholder if userId is null/undefined

    // Allow update if mounted AND (user IDs match OR userRef is null)
    if (isMounted.current && (currentUserId === checkUserId || currentUserId === null)) {
      logger.log(`[Admin Check][v${PROVIDER_VERSION}] safeSetIsAdmin: Updating isAdmin=${value} for user ${checkUserId}`);
      setIsAdmin(value);
    } else {
      logger.log(`[Admin Check][v${PROVIDER_VERSION}] safeSetIsAdmin: Skipped stale admin result for user ${checkUserId}. Current userRef: ${currentUserId}`);
    }
  };

  useEffect(() => {
    userRef.current = user;
    logger.log(`[Ref Update][v${PROVIDER_VERSION}] User state updated in ref:`, user?.id || 'null');
  }, [user]);

  useEffect(() => {
    sessionRef.current = session;
    logger.log(`[Ref Update][v${PROVIDER_VERSION}] Session state updated in ref:`, session ? 'present' : 'null');
  }, [session]);

  useEffect(() => {
    logger.log(`[Effect Setup][v${PROVIDER_VERSION}] AuthProvider effect setup starting`);
    isMounted.current = true;
    initialCheckCompleted.current = false; // Reset on effect setup

    const checkInitialSessionAndAdmin = async () => {
      logger.log(`[Initial Check][v${PROVIDER_VERSION}] START`);
      if (initialCheckCompleted.current) {
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] Already completed, skipping.`);
          // Still set loading false if it hasn't been set yet
          if (isLoading) {
            logger.log(`[Initial Check][v${PROVIDER_VERSION}] Setting isLoading=false (already completed case)`);
            setIsLoading(false);
          }
          return;
      }

      try {
        logger.log(`[Initial Check][v${PROVIDER_VERSION}] Calling supabase.auth.getSession()`);
        // Explicitly set loading true here *before* the async call
        // Although initialized to true, this ensures it's true if the effect re-runs
        if (!isLoading) { // Only log if changing state
            logger.log(`[Initial Check][v${PROVIDER_VERSION}] Setting isLoading=true (before getSession)`);
            setIsLoading(true);
        }
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted.current) {
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] Component unmounted during getSession, aborting.`);
          return;
        }
         logger.log(`[Initial Check][v${PROVIDER_VERSION}] getSession() returned. Error: ${!!error}, Session: ${!!data.session}`);

        if (error) {
          logger.warn(`[Initial Check][v${PROVIDER_VERSION}] getSession() error:`, error);
          // Treat error as no session
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] Setting state: session=null, user=null, isAdmin=false (due to getSession error)`);
          setSession(null);
          setUser(null);
          setIsAdmin(false); // Direct set is okay here, no user context for safeSet
        } else if (data.session) {
          const userId = data.session.user.id;
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] Session FOUND - User ID: ${userId}`);
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] Setting state: session=present, user=${userId}`);
          setSession(data.session);
          setUser(data.session.user); // userRef effect will update ref

          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            logger.log(`[Initial Check][v${PROVIDER_VERSION}] Starting ADMIN CHECK for user: ${userId}`);
            // Wrap the async admin check call in a self-invoking async function
            // so the main checkInitialSessionAndAdmin flow doesn't await it.
            (async () => {
                const checkUserId = userId; // Capture userId for closure
                try {
                  const adminStatus = await checkIsAdmin(checkUserId); // Await happens inside the IIFE
                   if (!isMounted.current) {
                     logger.log(`[Initial Check][v${PROVIDER_VERSION}] ADMIN CHECK: Component unmounted during check for ${checkUserId}, aborting status update.`);
                     adminCheckInProgress.current = false; // Reset flag if aborting
                     return;
                   }
                  logger.log(`[Initial Check][v${PROVIDER_VERSION}] ADMIN CHECK result for ${checkUserId}: ${adminStatus}`);
                  safeSetIsAdmin(checkUserId, adminStatus);
                } catch (adminError) {
                  logger.error(`[Initial Check][v${PROVIDER_VERSION}] ADMIN CHECK: Error checking admin status for ${checkUserId}:`, adminError);
                  // Set admin false on error only if still mounted and user hasn't changed
                  safeSetIsAdmin(checkUserId, false);
                } finally {
                   // Always reset flag, regardless of mount status
                   adminCheckInProgress.current = false;
                   if (isMounted.current) {
                     logger.log(`[Initial Check][v${PROVIDER_VERSION}] ADMIN CHECK finished for ${checkUserId}.`);
                   } else {
                     logger.log(`[Initial Check][v${PROVIDER_VERSION}] ADMIN CHECK finished for ${checkUserId}, but component unmounted.`);
                   }
                }
            })(); // Immediately invoke the async function
          } else {
            logger.log(`[Initial Check][v${PROVIDER_VERSION}] Admin check already in progress, skipping new check for ${userId}.`);
          }
        } else {
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] No session found.`);
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] Setting state: session=null, user=null, isAdmin=false`);
          setSession(null);
          setUser(null);
          setIsAdmin(false); // Direct set okay here
        }
      } catch (error) {
        logger.error(`[Initial Check][v${PROVIDER_VERSION}] Unexpected error:`, error);
        if (isMounted.current) {
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] Setting state: session=null, user=null, isAdmin=false (due to unexpected error)`);
          setSession(null);
          setUser(null);
          setIsAdmin(false); // Direct set okay here
        }
      } finally {
        if (isMounted.current) {
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] FINALLY block executing.`);
          if (!initialCheckCompleted.current) {
            logger.log(`[Initial Check][v${PROVIDER_VERSION}] Marking initial check as COMPLETED.`);
            initialCheckCompleted.current = true;
          }
          // Crucially, set loading to false *after* all checks/updates are done
          logger.log(`[Initial Check][v${PROVIDER_VERSION}] Setting isLoading=false (end of initial check).`);
          setIsLoading(false);
          // NEW: Clear fallback timeout now that initial check completed
          if (sessionFallbackTimeout.current) {
            clearTimeout(sessionFallbackTimeout.current);
            sessionFallbackTimeout.current = null;
          }
        } else {
           logger.log(`[Initial Check][v${PROVIDER_VERSION}] FINALLY block, component unmounted.`);
        }
      }
    };

    logger.log(`[Effect Setup][v${PROVIDER_VERSION}] Setting up onAuthStateChange listener`);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Event received: ${event}, User: ${currentSession?.user?.id || 'none'}, Session: ${!!currentSession}`);

        // --- Handling Before Initial Check Completion ---
        if (!initialCheckCompleted.current) {
           logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Initial check NOT complete. Evaluating event: ${event}`);
           // Case 1: Definitive Sign Out
           if (event === 'SIGNED_OUT' && !sessionRef.current) {
             logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Handling early SIGNED_OUT.`);
             if (isMounted.current) {
               logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Setting state: session=null, user=null, isAdmin=false, initialCheck=true, isLoading=false (early SIGNED_OUT)`);
               setSession(null);
               setUser(null);
               setIsAdmin(false); // Direct set okay
               initialCheckCompleted.current = true;
               setIsLoading(false);
               // Clear fallback timeout if active
               if (sessionFallbackTimeout.current) {
                 clearTimeout(sessionFallbackTimeout.current);
                 sessionFallbackTimeout.current = null;
               }
             }
             return; // Processed early exit
           }
           // Case 2: Early Sign In / Initial Session / Token Refresh (Fast Path)
           else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && currentSession) {
                logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Handling early ${event}. Processing immediately.`);
                const userId = currentSession.user.id;
                if (isMounted.current) {
                    logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Setting state: session=present, user=${userId}, initialCheck=true, isLoading=false (early ${event})`);
                    setSession(currentSession);
                    setUser(currentSession.user); // userRef effect updates ref
                    initialCheckCompleted.current = true;
                    setIsLoading(false);
                    // Clear fallback timeout if active
                    if (sessionFallbackTimeout.current) {
                      clearTimeout(sessionFallbackTimeout.current);
                      sessionFallbackTimeout.current = null;
                    }

                    // Trigger non-blocking admin check if user exists and none in progress
                    if (!adminCheckInProgress.current) {
                        adminCheckInProgress.current = true;
                        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Starting ADMIN CHECK for user ${userId} (early ${event})`);
                        (async () => {
                            const checkUserId = userId; // Capture userId for closure
                            try {
                                const adminStatus = await checkIsAdmin(checkUserId);
                                if (!isMounted.current) {
                                     logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK: Component unmounted during check for ${checkUserId} (early ${event}), aborting.`);
                                     adminCheckInProgress.current = false;
                                     return;
                                }
                                logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK result for ${checkUserId}: ${adminStatus} (early ${event})`);
                                safeSetIsAdmin(checkUserId, adminStatus);
                            } catch (adminError) {
                                logger.error(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK: Error for ${checkUserId} (early ${event}):`, adminError);
                                safeSetIsAdmin(checkUserId, false); // Use safeSet on error
                            } finally {
                                 // Always reset flag
                                 adminCheckInProgress.current = false;
                                 if (isMounted.current) {
                                    logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK finished for ${checkUserId} (early ${event}).`);
                                 } else {
                                    logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK finished after unmount for ${checkUserId} (early ${event}).`);
                                 }
                            }
                        })();
                    } else {
                       logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Admin check already in progress, skipping new check for ${userId} (early ${event}).`);
                    }
                }
                return; // Processed fast path
           }
           // Case 3: Other events before initial check completes
           else {
              logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Deferring full processing of event: ${event} (waiting for initial check)`);
              return; // Wait for initial check
           }
        }

        // --- Handling After Initial Check Completion ---
        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Processing event ${event} (initial check complete)`);

        // --- Username Sync Check ---
        if (currentSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          const userId = currentSession.user.id;
          // Get Discord info from metadata - Use 'name' instead of 'preferred_username'
          const discordUsername = currentSession.user.user_metadata?.name;
          const discordUserId = currentSession.user.user_metadata?.provider_id;

          if (discordUsername || discordUserId) { // Check if we have either username or ID from Discord
            logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Checking Discord ID/Username sync for user ${userId}. Metadata values - ID: ${discordUserId}, Username: ${discordUsername}`);
            try {
              // Fetch only the discord fields from the profile
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('discord_user_id, discord_username') // Only select discord fields
                .eq('id', userId)
                .maybeSingle();

              if (profileError) {
                logger.error(`[Auth Listener][v${PROVIDER_VERSION}] Error fetching profile for Discord sync for user ${userId}:`, profileError);
              } else if (profileData) {
                // Determine if an update is needed ONLY for discord fields
                const updatePayload: { discord_user_id?: string; discord_username?: string } = {};
                let needsUpdate = false;

                // Sync discord_username
                if (discordUsername && profileData.discord_username !== discordUsername) {
                  logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Discord username sync needed for ${userId}. DB: "${profileData.discord_username}", Discord: "${discordUsername}".`);
                  updatePayload.discord_username = discordUsername;
                  needsUpdate = true;
                }

                // Sync discord_user_id
                if (discordUserId && profileData.discord_user_id !== discordUserId) {
                   logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Discord user ID sync needed for ${userId}. DB: "${profileData.discord_user_id}", Discord: "${discordUserId}".`);
                  updatePayload.discord_user_id = discordUserId;
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Updating profile for ${userId} with Discord fields:`, updatePayload);
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update(updatePayload) // Only update discord fields
                    .eq('id', userId);

                  if (updateError) {
                    logger.error(`[Auth Listener][v${PROVIDER_VERSION}] Error updating profile with Discord fields for ${userId}:`, updateError);
                  } else {
                    logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Successfully updated Discord fields for ${userId}. Clearing profile cache.`);
                    userProfileCache.delete(userId); // Invalidate cache as profile data changed
                  }
                } else {
                   logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Discord fields for ${userId} (Username: '${profileData.discord_username}', ID: '${profileData.discord_user_id}') are already in sync.`);
                }

              } else if (!profileData) {
                logger.warn(`[Auth Listener][v${PROVIDER_VERSION}] Profile not found for user ${userId} during Discord sync check. Cannot update Discord fields.`);
              }
            } catch (syncError) {
              logger.error(`[Auth Listener][v${PROVIDER_VERSION}] Unexpected error during Discord sync check for ${userId}:`, syncError);
            }
          } else {
            logger.log(`[Auth Listener][v${PROVIDER_VERSION}] No Discord username ('name') or provider_id found in metadata for ${userId}, skipping sync check.`);
          }
        }
        // --- End Username Sync Check ---

        if (!isMounted.current) {
          logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Component unmounted, ignoring event ${event}.`);
          return;
        }

        // --- State Update Logic ---
        const newUser = currentSession?.user || null;
        const oldUser = userRef.current; // Get user from ref *before* potential update

        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Setting state: session=${!!currentSession}, user=${newUser?.id || 'null'}`);
        setSession(currentSession);
        setUser(newUser); // This triggers the userRef update effect

        // --- Admin Check Logic (Post-Initial Check) ---
        if (!newUser) {
          logger.log(`[Auth Listener][v${PROVIDER_VERSION}] No user in session, resetting admin status.`);
          // No need to use safeSetIsAdmin if newUser is null
          setIsAdmin(false);
        } else if (newUser.id !== oldUser?.id) { // Only check admin if the user *actually changed*
          if (!adminCheckInProgress.current) {
            adminCheckInProgress.current = true;
            const userId = newUser.id;
            logger.log(`[Auth Listener][v${PROVIDER_VERSION}] User changed (${oldUser?.id} -> ${userId}). Starting ADMIN CHECK.`);
            (async () => {
                const checkUserId = userId; // Capture userId for closure
                try {
                    const adminStatus = await checkIsAdmin(checkUserId);
                    if (!isMounted.current) {
                        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK: Component unmounted during check for ${checkUserId}, aborting.`);
                        adminCheckInProgress.current = false;
                        return;
                    }
                    logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK result for ${checkUserId}: ${adminStatus}`);
                    safeSetIsAdmin(checkUserId, adminStatus);
                } catch (adminError) {
                    logger.error(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK: Error for ${checkUserId}:`, adminError);
                    safeSetIsAdmin(checkUserId, false); // Use safeSet on error
                } finally {
                    // Always reset flag
                    adminCheckInProgress.current = false;
                    if (isMounted.current) {
                        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK finished for ${checkUserId}.`);
                    } else {
                        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN CHECK finished after unmount for ${checkUserId}.`);
                    }
                }
            })();
          } else {
            logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Admin check already in progress for user ${newUser.id}, skipping new check.`);
          }
        } else {
           logger.log(`[Auth Listener][v${PROVIDER_VERSION}] User unchanged (${newUser.id}), skipping admin check.`);
           // Ensure isAdmin state is still correct if somehow diverged (edge case)
           // The safeSetIsAdmin logic handles user match, but we can check if isAdmin is defined
           if (isAdmin === undefined && !adminCheckInProgress.current) {
             logger.warn(`[Auth Listener][v${PROVIDER_VERSION}] User unchanged but isAdmin is undefined, attempting re-check.`);
             adminCheckInProgress.current = true;
             const userId = newUser.id;
             (async () => {
                const checkUserId = userId; // Capture userId for closure
                try {
                    const status = await checkIsAdmin(checkUserId);
                    logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN RE-CHECK result for ${checkUserId}: ${status}`);
                    safeSetIsAdmin(checkUserId, status);
                } catch (err) {
                    logger.error(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN RE-CHECK: Error for ${checkUserId}:`, err);
                    safeSetIsAdmin(checkUserId, false); // Use safeSet on error
                } finally {
                    // Always reset flag
                    adminCheckInProgress.current = false;
                    if (isMounted.current) {
                        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN RE-CHECK finished for ${checkUserId}.`);
                    } else {
                        logger.log(`[Auth Listener][v${PROVIDER_VERSION}] ADMIN RE-CHECK finished after unmount for ${checkUserId}.`);
                    }
                }
             })();
           }
        }
        // Ensure loading is false after processing an event post-initial check
        if (isLoading) { // Only log if changing state
            logger.log(`[Auth Listener][v${PROVIDER_VERSION}] Setting isLoading=false (end of processing event ${event}).`);
            setIsLoading(false);
            // Clear fallback timeout if active
            if (sessionFallbackTimeout.current) {
              clearTimeout(sessionFallbackTimeout.current);
              sessionFallbackTimeout.current = null;
            }
        }
      }
    );

    // Initial check invocation
    logger.log(`[Effect Setup][v${PROVIDER_VERSION}] Invoking checkInitialSessionAndAdmin`);
    checkInitialSessionAndAdmin();

    // NEW: Fallback timeout – ensure we don't stay stuck in loading forever
    if (sessionFallbackTimeout.current) {
      clearTimeout(sessionFallbackTimeout.current);
    }
    sessionFallbackTimeout.current = setTimeout(() => {
      if (isMounted.current && isLoading) {
        logger.warn(`[Timeout][v${PROVIDER_VERSION}] Initial session check exceeded 5000ms. Forcing isLoading=false`);
        setIsLoading(false);
        if (!initialCheckCompleted.current) {
          initialCheckCompleted.current = true;
        }
      }
    }, 5000); // 5 seconds fallback

    // Cleanup function
    return () => {
      logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}] Unsubscribing and setting isMounted=false`);
      isMounted.current = false;
      subscription.unsubscribe();
      // Ensure any long-running admin check can't block future mounts.
      logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}] Resetting adminCheckInProgress flag.`);
      adminCheckInProgress.current = false;
      // Clear fallback timeout
      if (sessionFallbackTimeout.current) {
        clearTimeout(sessionFallbackTimeout.current);
        sessionFallbackTimeout.current = null;
      }
    };
  // IMPORTANT: Minimal dependencies. This effect should run essentially once on mount.
  // Adding dependencies like `isLoading` can cause infinite loops.
  }, []);

  // Sign-in function
  const signIn = async (email: string, password: string) => {
     logger.log(`[Auth Action][v${PROVIDER_VERSION}] signIn: Attempting for email: ${email}`);
    try {
      toast.loading('Signing in...', { id: 'signin-toast' });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      toast.dismiss('signin-toast');

      if (error) {
        logger.error(`[Auth Action][v${PROVIDER_VERSION}] signIn: Error for ${email}:`, error);
        throw error;
      }

      logger.log(`[Auth Action][v${PROVIDER_VERSION}] signIn: Successful for ${email}`);
    } catch (error: any) {
      toast.dismiss('signin-toast');
      toast.error(error.message || 'Error signing in');
      logger.error(`[Auth Action][v${PROVIDER_VERSION}] signIn: Catch block error for ${email}:`, error);
    }
  };

  // Sign-out function
  const signOut = async () => {
    logger.log(`[Auth Action][v${PROVIDER_VERSION}] signOut: Attempting sign out`);
    try {
      toast.loading('Signing out...', { id: 'signout-toast' });
      await supabase.auth.signOut();
      toast.dismiss('signout-toast');
      logger.log(`[Auth Action][v${PROVIDER_VERSION}] signOut: Successful`);
    } catch (error: any) {
      toast.dismiss('signout-toast');
      toast.error(error.message || 'Error signing out');
      logger.error(`[Auth Action][v${PROVIDER_VERSION}] signOut: Error:`, error);
    }
  };

  logger.log(`[Render][v${PROVIDER_VERSION}] AuthProvider rendering. State: isLoading=${isLoading}, user=${user?.id || 'null'}, session=${!!session}, isAdmin=${isAdmin}, initialCheckCompleted=${initialCheckCompleted.current}, adminCheckInProgress=${adminCheckInProgress.current}`);

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
