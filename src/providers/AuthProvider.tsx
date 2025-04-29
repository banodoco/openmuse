import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { AuthContext } from '@/contexts/AuthContext';
import { checkIsAdmin } from '@/lib/auth';
import { userProfileCache } from '@/lib/auth/cache';
import { v4 as uuidv4 } from 'uuid'; // Ensure installed: npm install uuid @types/uuid

// Use single optional tag parameter for Logger (expects 1-3 args). Combine tags into one.
const logger = new Logger('AuthProvider', true, 'SessionPersist-Leader');
const PROVIDER_VERSION = '1.5.0'; // Increment version for LocalStorage-only leader election
logger.log(`--- AuthProvider Module Initial Load [v${PROVIDER_VERSION}] ---`);

// Constants for LocalStorage Leader Election
const HEARTBEAT_INTERVAL = 4000; // Interval for leader to update timestamp
const LEADERSHIP_TIMEOUT = 5000; // Max time before a leader is considered stale
const CLAIM_TIMEOUT_DURATION = 100; // Short delay before confirming claim after writing
const LOCAL_LEADER_KEY = 'auth_leader_info'; // Key to store current leader tab info as JSON
interface LeaderInfo {
  tabId: string;
  timestamp: number;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tabId = useRef<string>(uuidv4()); // Generate ID immediately
  logger.log(`AuthProvider component mounting [v${PROVIDER_VERSION}] - Tab ID: ${tabId.current}`);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLeader, setIsLeader] = useState(false); // Track leadership (now driven by localStorage)

  const userRef = useRef<User | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const isMounted = useRef(true); // Still useful for async operations
  const initialCheckCompleted = useRef(false);
  const adminCheckInProgress = useRef(false);
  const sessionFallbackTimeout = useRef<NodeJS.Timeout | null>(null);

  /* ------------------------------------------------------------------
     LocalStorage-based Leader Election (Sole Mechanism)
     ------------------------------------------------------------------ */

  // Helper to read leader info from localStorage (with safe JSON parse)
  const readLeaderInfo = useCallback((): LeaderInfo | null => {
    if (typeof window === 'undefined' || !window.localStorage) return null; // Guard for SSR or environments without localStorage
    try {
      const raw = localStorage.getItem(LOCAL_LEADER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Basic validation
      if (typeof parsed === 'object' && parsed !== null && typeof parsed.tabId === 'string' && typeof parsed.timestamp === 'number') {
        return parsed as LeaderInfo;
      }
      return null;
    } catch (_err) {
      logger.warn(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Error parsing leader info from localStorage.`);
      localStorage.removeItem(LOCAL_LEADER_KEY); // Clear invalid data
      return null;
    }
  }, []);

  // Helper to write this tab as leader with current timestamp
  const writeLeaderInfo = useCallback(() => {
    if (typeof window === 'undefined' || !window.localStorage) return; // Guard
    const info: LeaderInfo = { tabId: tabId.current, timestamp: Date.now() };
    try {
      localStorage.setItem(LOCAL_LEADER_KEY, JSON.stringify(info));
    } catch (err) {
      logger.error(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Error writing leader info to localStorage:`, err);
    }
  }, [tabId]); // Added tabId ref to dependency (though it's stable)

  // Attempt to claim leadership
  const attemptClaimLeadershipLS = useCallback(() => {
    if (!isMounted.current || typeof window === 'undefined' || !window.localStorage) return; // Guard

    const existing = readLeaderInfo();
    const now = Date.now();
    // Leader is stale if no leader exists OR timestamp is too old
    const leaderIsStale = !existing || now - existing.timestamp > LEADERSHIP_TIMEOUT;

    if (leaderIsStale) {
      logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Leader is stale or absent. Attempting claim.`);
      // Write our potential claim
      writeLeaderInfo();

      // Confirm after a short delay, allowing other tabs to potentially overwrite
      setTimeout(() => {
        if (!isMounted.current) return; // Check mount status again after timeout

        const current = readLeaderInfo();
        if (current && current.tabId === tabId.current) {
          // Our claim seems to have held
          if (!isLeader) { // Update state only if it changed
            logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Confirmed leadership via localStorage claim.`);
            setIsLeader(true);
          }
        } else {
          // Claim was overwritten or failed
          if (isLeader) { // Update state only if it changed
             logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Claim failed or was overwritten by tab ${current?.tabId}. Relinquishing.`);
             setIsLeader(false);
          }
        }
      }, CLAIM_TIMEOUT_DURATION); // Use short confirmation timeout
    } else {
       // A valid leader exists, ensure we are not marked as leader
       if (isLeader && existing?.tabId !== tabId.current) {
         logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Valid leader ${existing?.tabId} exists. Ensuring this tab is not leader.`);
         setIsLeader(false);
       }
    }
     // Add isLeader to dependencies as we read it
  }, [readLeaderInfo, writeLeaderInfo, isLeader, tabId]);

  // Heartbeat effect & storage listener
  useEffect(() => {
    logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] Setting up LocalStorage leader election.`);
    isMounted.current = true;

    // Guard for environments without window or localStorage
    if (typeof window === 'undefined' || !window.localStorage) {
        logger.warn(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] localStorage not available. Leader election disabled.`);
        setIsLoading(false); // Ensure loading doesn't hang if election can't run
        return;
    }


    // Immediately attempt claim on mount (slightly jittered to reduce collisions)
    const jitter = Math.random() * 300;
    const initialTimer = setTimeout(attemptClaimLeadershipLS, 300 + jitter);

    // Storage event listener – reacts to leader changes in other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== LOCAL_LEADER_KEY || !isMounted.current) return;

      logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Storage event received for key ${e.key}.`);

      let info: LeaderInfo | null = null;
      try {
         info = e.newValue ? JSON.parse(e.newValue) : null;
         // Validate parsed info
         if (info && (typeof info.tabId !== 'string' || typeof info.timestamp !== 'number')) {
            logger.warn(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Invalid data format in storage event. Ignoring.`);
            info = null; // Treat as invalid
         }
      } catch (_err) {
         logger.warn(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Error parsing storage event value. Key: ${e.key}`);
         info = null; // Treat as invalid / removed
      }


      if (info && info.tabId === tabId.current) {
        // Our own write echoed back, ensure leader state is true
        if (!isLeader) {
           logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Storage event confirms self as leader.`);
           setIsLeader(true);
        }
      } else if (info && info.tabId !== tabId.current) {
        // Another tab is leader, ensure leader state is false
        if (isLeader) {
          logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Storage event indicates new leader: ${info.tabId}. Relinquishing.`);
          setIsLeader(false);
        }
      } else if (!info) {
        // Leader key removed or invalid – attempt to claim
        logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Storage event indicates leader key removed/invalid. Attempting claim.`);
        if (isLeader) setIsLeader(false); // Ensure we aren't leader first
        attemptClaimLeadershipLS();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Heartbeat interval – Leader writes, Non-leaders check staleness
    const hbInterval = setInterval(() => {
       if (!isMounted.current) {
         clearInterval(hbInterval);
         return;
       }

      if (isLeader) {
        // logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Sending heartbeat (writing timestamp).`);
        writeLeaderInfo(); // Update our timestamp
      } else {
        // Not the leader, check if the current leader is stale
        const currentLeaderInfo = readLeaderInfo();
        if (!currentLeaderInfo || Date.now() - currentLeaderInfo.timestamp > LEADERSHIP_TIMEOUT) {
          // logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Detected stale/no leader during interval check. Attempting claim.`);
          attemptClaimLeadershipLS();
        }
      }
    }, HEARTBEAT_INTERVAL);

    // On unload, if we are leader, try to clear the key
    const handleBeforeUnload = () => {
       logger.log(`[Event][v${PROVIDER_VERSION}][${tabId.current}] Window unloading. isLeader: ${isLeader}`);
       // Use readLeaderInfo to double-check we are *still* the leader right before unload
      const currentInfo = readLeaderInfo();
      if (currentInfo && currentInfo.tabId === tabId.current) {
          logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Unloading as leader. Removing leader key.`);
        try {
          // Use synchronous remove on unload
          localStorage.removeItem(LOCAL_LEADER_KEY);
        } catch (_) {
           logger.warn(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Failed to remove leader key on unload.`);
        }
      }
       isMounted.current = false; // Mark as unmounted
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}][${tabId.current}] Cleaning up LocalStorage leader election.`);
      isMounted.current = false; // Ensure flag is set
      clearTimeout(initialTimer);
      clearInterval(hbInterval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // On cleanup (component unmount), if we were leader, relinquish by removing key
      // Check isLeader state *and* localStorage to be sure before removing
      const currentInfo = readLeaderInfo();
      if (isLeader && currentInfo && currentInfo.tabId === tabId.current) {
          logger.log(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Unmounting as leader. Removing leader key.`);
        try {
          localStorage.removeItem(LOCAL_LEADER_KEY);
        } catch (_) {
           logger.warn(`[Leader-LS][v${PROVIDER_VERSION}][${tabId.current}] Failed to remove leader key on unmount cleanup.`);
        }
      }
    };
     // Dependencies: Key functions controlling the LS leader logic and isLeader state itself
  }, [attemptClaimLeadershipLS, isLeader, readLeaderInfo, writeLeaderInfo, tabId]);


 // --- safeSetIsAdmin definition (moved outside effects) ---
  const safeSetIsAdmin = useCallback((userId: string | null | undefined, value: boolean) => {
    const currentUserId = userRef.current?.id;
    const checkUserId = userId; // Use the passed userId directly

    // Only update if mounted AND the user context matches
    if (isMounted.current && currentUserId === checkUserId) {
      // Use functional update form of setIsAdmin to avoid depending on `isAdmin` state directly
      setIsAdmin(currentState => {
        if (currentState !== value) {
           logger.log(`[Admin Check][v${PROVIDER_VERSION}][${tabId.current}] safeSetIsAdmin: Updating isAdmin=${value} for user ${checkUserId}`);
           return value; // Return the new value
        }
        // logger.log(`[Admin Check][v${PROVIDER_VERSION}][${tabId.current}] safeSetIsAdmin: isAdmin already ${value}. No update.`);
        return currentState; // Return current state if no change needed
      });
    } else {
      logger.log(`[Admin Check][v${PROVIDER_VERSION}][${tabId.current}] safeSetIsAdmin: Skipped admin update. Mounted: ${isMounted.current}, User Match: ${currentUserId === checkUserId} (Current: ${currentUserId}, Check: ${checkUserId}). Target value: ${value}`);
    }
  }, [tabId]);


  // --- Original useEffect for Auth State Changes (Supabase Listener) ---
  useEffect(() => {
    logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] AuthProvider effect setup starting (Supabase listener)`);
    isMounted.current = true; // Ensure mounted is true at start of this effect too
    initialCheckCompleted.current = false; // Reset on effect setup


    const checkInitialSessionAndAdmin = async () => {
        logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] START`);
        if (initialCheckCompleted.current) {
            logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Already completed, skipping.`);
            if (isLoading) setIsLoading(false); // Ensure loading is false if skipped
            return;
        }

        if (!isMounted.current) {
            logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Aborted: Component unmounted before check started.`);
            // Explicitly set loading false if unmounted before check could finish
            // This prevents getting stuck in loading state on rapid mount/unmount
            setIsLoading(false);
            return;
        }

        let sessionData: Session | null = null;
        let userData: User | null = null;
        const isAdminStatus = false; // Default to false

        try {
            // Ensure loading is true before async calls, only log if changing
            if (!isLoading) {
               logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Setting isLoading=true (before getSession)`);
               setIsLoading(true);
            }

            const getSessionStart = performance.now();
            logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Calling supabase.auth.getSession() - START`);
            const { data, error } = await supabase.auth.getSession();
            const getSessionDuration = (performance.now() - getSessionStart).toFixed(2);
            logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] supabase.auth.getSession() - END - Duration: ${getSessionDuration} ms`);

            if (!isMounted.current) {
              logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Component unmounted during getSession, aborting state updates.`);
              setIsLoading(false); // Ensure loading stops
              return;
            }
             logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] getSession() returned. Error: ${!!error}, Session: ${!!data.session}`);

            if (error) {
              logger.warn(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] getSession() error:`, error);
              // Maintain defaults (null session/user, false admin)
            } else if (data.session) {
              const userId = data.session.user.id;
              logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Session FOUND - User ID: ${userId}`);
              sessionData = data.session;
              userData = data.session.user;

              // Perform admin check non-blockingly only if needed
              if (!adminCheckInProgress.current) {
                  adminCheckInProgress.current = true;
                  logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Starting ADMIN CHECK for user: ${userId}`);
                  (async () => {
                      const checkUserId = userId;
                      try {
                          const adminResult = await checkIsAdmin(checkUserId);
                          if (!isMounted.current) {
                              logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK: Component unmounted during check for ${checkUserId}, aborting status update.`);
                              // No state update needed if unmounted
                          } else {
                             logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK result for ${checkUserId}: ${adminResult}`);
                             safeSetIsAdmin(checkUserId, adminResult); // Use safe setter
                          }
                      } catch (adminError) {
                          logger.error(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK: Error checking admin status for ${checkUserId}:`, adminError);
                          if (isMounted.current) safeSetIsAdmin(checkUserId, false); // Use safe setter on error
                      } finally {
                          // Reset flag regardless of mount status
                          adminCheckInProgress.current = false;
                          if (isMounted.current) {
                             logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK finished for ${checkUserId}.`);
                          } else {
                             logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK finished for ${checkUserId} (component unmounted).`);
                          }
                      }
                  })();
              } else {
                  logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Admin check already in progress, skipping new check for ${userId}.`);
              }
              // isAdminStatus remains false here; it's set asynchronously by safeSetIsAdmin
            } else {
              logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] No session found.`);
               // Maintain defaults (null session/user, false admin)
            }
        } catch (error) {
            logger.error(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Unexpected error during initial check:`, error);
            // Maintain defaults in case of unexpected errors, ensure state is updated if mounted
            if (!isMounted.current) {
                logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Unexpected error caught, but component unmounted.`);
                setIsLoading(false); // Ensure loading stops
                return; // Don't proceed if unmounted
            }
        } finally {
            if (isMounted.current) {
                logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] FINALLY block executing.`);
                // Set state based on findings *after* potential admin check started
                logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Setting final initial state: session=${!!sessionData}, user=${userData?.id || 'null'}, isAdmin=${isAdminStatus}`);
                setSession(sessionData);
                setUser(userData);
                setIsAdmin(isAdminStatus); // Set initial admin state (usually false, updated async)

                if (!initialCheckCompleted.current) {
                    logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Marking initial check as COMPLETED.`);
                    initialCheckCompleted.current = true;
                }
                logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Setting isLoading=false (end of initial check).`);
                setIsLoading(false);

                // Clear fallback timeout now that initial check completed (successfully or with error)
                if (sessionFallbackTimeout.current) {
                    clearTimeout(sessionFallbackTimeout.current);
                    sessionFallbackTimeout.current = null;
                     logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] Cleared session fallback timeout.`);
                }
            } else {
               logger.log(`[Initial Check][v${PROVIDER_VERSION}][${tabId.current}] FINALLY block skipped, component unmounted.`);
            }
        }
    };


    logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] Setting up onAuthStateChange listener`);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
          // Check mount status at the very beginning of the listener callback
          if (!isMounted.current) {
            // logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Event ${event} received, but component unmounted. Ignoring.`);
            return;
          }

          logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Event received: ${event}, User: ${currentSession?.user?.id || 'none'}, Session: ${!!currentSession}. Leader: ${isLeader}, InitDone: ${initialCheckCompleted.current}`);

          // --- Handling Before Initial Check Completion ---
            if (!initialCheckCompleted.current) {
                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Initial check NOT complete. Evaluating event: ${event}`);
                 // Allow processing SIGNED_OUT or fast-path SIGNED_IN/INITIAL_SESSION to potentially complete the initial check early
                 switch (event) {
                    case 'SIGNED_OUT': { // Wrap in block for lexical declaration
                         logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Handling early SIGNED_OUT.`);
                         // Check isMounted again *inside* the case before setting state
                         if (isMounted.current) {
                             logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Setting state: session=null, user=null, isAdmin=false, initialCheck=true, isLoading=false (early SIGNED_OUT)`);
                             setSession(null);
                             setUser(null);
                             setIsAdmin(false);
                             initialCheckCompleted.current = true; // Mark as completed
                             setIsLoading(false);
                             if (sessionFallbackTimeout.current) clearTimeout(sessionFallbackTimeout.current); sessionFallbackTimeout.current = null;
                         }
                         return; // Processed early exit
                    }
                    case 'SIGNED_IN':
                    case 'INITIAL_SESSION':
                    case 'TOKEN_REFRESHED': { // Wrap in block
                       if (currentSession) {
                          logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Handling early ${event}. Processing immediately.`);
                           const userId = currentSession.user.id;
                           if (isMounted.current) {
                               logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Setting state: session=present, user=${userId}, initialCheck=true, isLoading=false (early ${event})`);
                               setSession(currentSession);
                               setUser(currentSession.user);
                               initialCheckCompleted.current = true; // Mark as completed
                               setIsLoading(false);
                               if (sessionFallbackTimeout.current) clearTimeout(sessionFallbackTimeout.current); sessionFallbackTimeout.current = null;

                               // Trigger non-blocking admin check only if necessary
                               if (!adminCheckInProgress.current) {
                                   adminCheckInProgress.current = true;
                                   logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Starting ADMIN CHECK for user ${userId} (early ${event})`);
                                   (async () => {
                                       const checkUserId = userId;
                                       try {
                                           const adminStatus = await checkIsAdmin(checkUserId);
                                           // Check mount status again before setting state
                                           if (isMounted.current) safeSetIsAdmin(checkUserId, adminStatus);
                                       } catch (adminError) {
                                           logger.error(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK: Error for ${checkUserId} (early ${event}):`, adminError);
                                           if (isMounted.current) safeSetIsAdmin(checkUserId, false);
                                       } finally {
                                            adminCheckInProgress.current = false;
                                            // Log completion status based on mount state
                                            if(isMounted.current) {
                                                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK finished for ${checkUserId} (early ${event}).`);
                                            } else {
                                                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK finished for ${checkUserId} (early ${event}, component unmounted).`);
                                            }
                                       }
                                   })();
                               } else {
                                  logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Admin check already in progress, skipping new check for ${userId} (early ${event}).`);
                               }
                           }
                           return; // Processed fast path
                       } else {
                            // If event is SIGNED_IN etc but session is null, wait for initial check
                            logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Event ${event} received without session before initial check. Deferring.`);
                            return;
                       }
                    }
                    default:
                       // For other events (PASSWORD_RECOVERY, USER_UPDATED before initial check), wait.
                      logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Deferring processing of event: ${event} (waiting for initial check)`);
                      return;
                 }
            }

          // --- Handling After Initial Check Completion ---
            logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Processing event ${event} (initial check complete)`);

          // --- LEADER ONLY: Discord Sync Check ---
          if (isLeader && isMounted.current && currentSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
              const userId = currentSession.user.id;
              const discordUsername = currentSession.user.user_metadata?.name;
              const discordUserId = currentSession.user.user_metadata?.provider_id;

              if (discordUsername || discordUserId) {
                 logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}][LEADER] Checking Discord ID/Username sync for user ${userId}.`);
                 try {
                   const { data: profileData, error: profileError } = await supabase
                     .from('profiles')
                     .select('discord_user_id, discord_username')
                     .eq('id', userId)
                     .maybeSingle();

                    if (profileError) {
                       logger.error(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}][LEADER] Error fetching profile for Discord sync for ${userId}:`, profileError);
                    } else if (profileData) {
                         const updatePayload: { discord_user_id?: string; discord_username?: string } = {};
                         let needsUpdate = false;
                         if (discordUsername && profileData.discord_username !== discordUsername) { updatePayload.discord_username = discordUsername; needsUpdate = true; }
                         if (discordUserId && profileData.discord_user_id !== discordUserId) { updatePayload.discord_user_id = discordUserId; needsUpdate = true; }

                         if (needsUpdate) {
                            logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}][LEADER] Updating profile for ${userId} with Discord fields:`, updatePayload);
                            const { error: updateError } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
                            if (updateError) {
                               logger.error(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}][LEADER] Error updating profile with Discord fields for ${userId}:`, updateError);
                            } else {
                               logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}][LEADER] Successfully updated Discord fields for ${userId}. Clearing profile cache.`);
                               userProfileCache.delete(userId); // Invalidate cache
                            }
                         }
                    } else {
                       logger.warn(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}][LEADER] Profile not found for user ${userId} during Discord sync check.`);
                    }
                 } catch (syncError) {
                    logger.error(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}][LEADER] Unexpected error during Discord sync check for ${userId}:`, syncError);
                 }
              }
          }
          // --- End Discord Sync Check ---


          // Re-check mount status before proceeding with state updates
            if (!isMounted.current) {
              logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Component unmounted after Discord check, ignoring further processing of event ${event}.`);
                return;
            }

          // --- State Update Logic (Runs in all tabs) ---
            const newUser = currentSession?.user || null;
          const oldUser = userRef.current; // Get user from ref *before* potential update

          // Update User and Session state only if they have actually changed
          if (sessionRef.current?.access_token !== currentSession?.access_token) {
              logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Updating session state.`);
              setSession(currentSession); // sessionRef effect updates ref
          }
          if (userRef.current?.id !== newUser?.id) {
               logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Updating user state: ${oldUser?.id} -> ${newUser?.id}`);
               setUser(newUser); // userRef effect updates ref
          }

          // --- Admin Check Logic (Post-Initial Check - Runs in all tabs if user changes) ---
             if (!newUser) {
                // User signed out, ensure admin is false if it wasn't already
                if (isAdmin) {
                     logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] No user in session, resetting admin status.`);
                     setIsAdmin(false);
                }
             } else if (newUser.id !== oldUser?.id) { // User *actually changed*
                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] User changed (${oldUser?.id} -> ${newUser.id}). Resetting admin & starting check.`);
                // Reset admin state immediately for the new user, then check
                setIsAdmin(false); // Assume not admin until checked
                if (!adminCheckInProgress.current) {
                   adminCheckInProgress.current = true;
                   const userId = newUser.id;
                   logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Starting ADMIN CHECK for new user ${userId}.`);
                   (async () => {
                       const checkUserId = userId;
                       try {
                           const adminStatus = await checkIsAdmin(checkUserId);
                           // Check mount status again before setting state
                           if (isMounted.current) safeSetIsAdmin(checkUserId, adminStatus);
                       } catch (adminError) {
                           logger.error(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK: Error for ${checkUserId}:`, adminError);
                           if (isMounted.current) safeSetIsAdmin(checkUserId, false);
                       } finally {
                           adminCheckInProgress.current = false;
                            if (isMounted.current) {
                                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK finished for ${checkUserId}.`);
                            } else {
                                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK finished for ${checkUserId} (component unmounted).`);
                            }
                       }
                   })();
                } else {
                   logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Admin check already in progress for user ${newUser.id}, skipping new check trigger.`);
                }
             } // else: User unchanged, no need to re-trigger admin check

          // Ensure loading is false after processing an event post-initial check
            if (isLoading) {
                 logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Setting isLoading=false (end of processing event ${event}).`);
                 setIsLoading(false);
                 // Clear fallback timeout again just in case it was still running
                 if (sessionFallbackTimeout.current) {
                     clearTimeout(sessionFallbackTimeout.current);
                     sessionFallbackTimeout.current = null;
                     logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Cleared session fallback timeout (event processing).`);
                 }
            }
      }
    );

    // Initial check invocation
    logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] Invoking checkInitialSessionAndAdmin`);
    checkInitialSessionAndAdmin();

    // Fallback timeout for initial load - ensures isLoading doesn't stick forever
     if (sessionFallbackTimeout.current) { clearTimeout(sessionFallbackTimeout.current); }
     logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] Setting session fallback timeout (${LEADERSHIP_TIMEOUT}ms).`);
     sessionFallbackTimeout.current = setTimeout(() => {
       // Check mount status inside timeout callback
       if (isMounted.current && isLoading) {
         logger.warn(`[Timeout][v${PROVIDER_VERSION}][${tabId.current}] Initial session check exceeded timeout. Forcing isLoading=false and marking check complete.`);
         setIsLoading(false);
         if (!initialCheckCompleted.current) {
           initialCheckCompleted.current = true; // Mark as completed on timeout
         }
       } else if (isMounted.current && !isLoading) {
          // Timeout fired but loading is already false (normal case)
          // logger.log(`[Timeout][v${PROVIDER_VERSION}][${tabId.current}] Session fallback timeout fired, but isLoading is already false.`);
       } else {
          // Timeout fired but component unmounted
           logger.log(`[Timeout][v${PROVIDER_VERSION}][${tabId.current}] Session fallback timeout fired, but component is unmounted.`);
       }
       sessionFallbackTimeout.current = null; // Clear ref after execution
     }, LEADERSHIP_TIMEOUT); // Use leadership timeout as a reasonable duration


    // Cleanup function for auth subscription
    return () => {
      logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}][${tabId.current}] Unsubscribing Supabase auth listener.`);
      isMounted.current = false; // Set unmounted flag for this effect's scope
      subscription.unsubscribe();
      // Clear timeout if component unmounts before it fires
      if (sessionFallbackTimeout.current) {
        clearTimeout(sessionFallbackTimeout.current);
        sessionFallbackTimeout.current = null;
        logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}][${tabId.current}] Cleared session fallback timeout on unmount.`);
      }
      // Reset admin check flag if unmounting during check? - Handled in async flow now
    };
  // Dependencies: safeSetIsAdmin is stable, tabId is a stable ref.
  // isLoading, isAdmin, and isLeader should NOT be dependencies here, as changes
  // to them are handled *within* the listener or initial check logic, and adding
  // them would cause infinite loops.
  }, [safeSetIsAdmin, tabId]);


  // --- Effect to update userRef ---
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // --- Effect to update sessionRef ---
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);


  // --- Sign-in function (Leader Gated) ---
  const signIn = useCallback(async (email: string, password: string) => {
     logger.log(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signIn attempt for ${email}. Is Leader: ${isLeader}`);
     if (!isLeader) {
       logger.warn(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signIn blocked: Not the leader tab.`);
       toast.info('Another tab is managing the session. Please use the active tab.', { id: `signin-blocked-${tabId.current}` });
       return; // Don't proceed if not the leader
     }

    const toastId = `signin-toast-${Date.now()}`; // Use const
    try {
      toast.loading('Signing in...', { id: toastId });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      // onAuthStateChange handles state updates

      toast.dismiss(toastId); // Dismiss loading regardless of outcome

      if (error) {
        logger.error(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}][LEADER] signIn: Error for ${email}:`, error);
        toast.error(error.message || 'Error signing in', { id: `signin-error-${Date.now()}`});
      } else {
          logger.log(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}][LEADER] signIn: Successful for ${email}. Waiting for onAuthStateChange.`);
          // Optional success toast: toast.success('Signed in successfully!', { id: `signin-success-${Date.now()}` });
      }

    } catch (error: unknown) { // Use unknown for catch block error
      toast.dismiss(toastId); // Ensure loading toast is dismissed on catch
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error signing in';
      toast.error(errorMessage, { id: `signin-catch-${Date.now()}` });
      logger.error(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}][LEADER] signIn: Catch block error for ${email}:`, error);
    }
  }, [isLeader, tabId]); // Include tabId dependency

  // --- Sign-out function (Leader Gated) ---
  const signOut = useCallback(async () => {
    logger.log(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signOut attempt. Is Leader: ${isLeader}`);
    if (!isLeader) {
      logger.warn(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signOut blocked: Not the leader tab.`);
       toast.info('Another tab is managing the session. Please use the active tab.', { id: `signout-blocked-${tabId.current}` });
      return; // Don't proceed if not the leader
    }

    const toastId = `signout-toast-${Date.now()}`; // Use const
    try {
      toast.loading('Signing out...', { id: toastId });
      const { error } = await supabase.auth.signOut();
      // onAuthStateChange handles state updates

      toast.dismiss(toastId); // Dismiss loading toast

      if (error) {
          logger.error(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}][LEADER] signOut: Error:`, error);
          toast.error(error.message || 'Error signing out', { id: `signout-error-${Date.now()}` });
      } else {
          logger.log(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}][LEADER] signOut: Successful. Waiting for onAuthStateChange.`);
          // No need to manually relinquish leader here, storage event + heartbeat check handles it.
      }
    } catch (error: unknown) { // Use unknown for catch block error
      toast.dismiss(toastId); // Ensure loading toast dismissed on catch
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error signing out';
      toast.error(errorMessage, { id: `signout-catch-${Date.now()}` });
      logger.error(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}][LEADER] signOut: Catch block error:`, error);
    }
  }, [isLeader, tabId]); // Include tabId dependency


  // Log render cycle (uncomment for debugging)
  // logger.log(`[Render][v${PROVIDER_VERSION}][${tabId.current}] Rendering. State: isLoading=${isLoading}, user=${user?.id || 'null'}, session=${!!session}, isAdmin=${isAdmin}, isLeader=${isLeader}, initialCheckCompleted=${initialCheckCompleted.current}`);

  // Provide the context value
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        isLoading,
        isLeader, // Expose leader status
        signIn,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;