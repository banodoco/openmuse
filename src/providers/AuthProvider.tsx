import React, { useState, useEffect, useRef, useCallback } from 'react';
// ... other imports
import { v4 as uuidv4 } from 'uuid'; // Need to install uuid: npm install uuid @types/uuid

// ... logger, PROVIDER_VERSION etc.

const AUTH_CHANNEL_NAME = 'auth_leader_channel';
const HEARTBEAT_INTERVAL = 4000; // Check leadership every 4s
const LEADERSHIP_TIMEOUT = 5000; // Assume leadership if no contest within 5s

// Message Types for BroadcastChannel
enum AuthChannelMessage {
  CLAIM_LEADER = 'CLAIM_LEADER',
  HEARTBEAT = 'HEARTBEAT',
  RELINQUISH_LEADER = 'RELINQUISH_LEADER',
  // We might not need explicit ACTION messages if onAuthStateChange is sufficient
  // ACTION_SIGN_IN = 'ACTION_SIGN_IN',
  // ACTION_SIGN_OUT = 'ACTION_SIGN_OUT',
}

interface AuthMessageData {
  type: AuthChannelMessage;
  tabId: string;
  timestamp: number;
}


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  logger.log(`AuthProvider component mounting [v${PROVIDER_VERSION}]`);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLeader, setIsLeader] = useState(false); // NEW: Track leadership

  const userRef = useRef<User | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const isMounted = useRef(true);
  const initialCheckCompleted = useRef(false);
  const adminCheckInProgress = useRef(false);
  const sessionFallbackTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- NEW Refs for Leader Election ---
  const tabId = useRef<string>(uuidv4()); // Unique ID for this tab instance
  const leaderId = useRef<string | null>(null); // Track current leader's ID
  const broadcastChannel = useRef<BroadcastChannel | null>(null);
  const leadershipClaimTimeout = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatReceived = useRef<Record<string, number>>({}); // Track heartbeats from other tabs

  // --- Leader Election Logic ---

  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Stopping heartbeat.`);
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat(); // Ensure no duplicate intervals
    logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Starting heartbeat.`);
    heartbeatInterval.current = setInterval(() => {
      if (isMounted.current && isLeader) { // Double check state just before sending
         // logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Sending HEARTBEAT.`);
         broadcastChannel.current?.postMessage({
           type: AuthChannelMessage.HEARTBEAT,
           tabId: tabId.current,
           timestamp: Date.now(),
         });
       } else {
         // logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Heartbeat skipped (not leader or unmounted).`);
         stopHeartbeat(); // Stop if no longer leader
       }
    }, HEARTBEAT_INTERVAL);
  }, [isLeader, stopHeartbeat]); // Dependency on isLeader state

  const relinquishLeadership = useCallback((silent = false) => {
    logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Relinquishing leadership. Current leader: ${leaderId.current}. Silent: ${silent}`);
    stopHeartbeat();
    if (isLeader) { // Only update state if we actually were the leader
      logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Setting isLeader = false.`);
      setIsLeader(false);
    }
    leaderId.current = null; // Clear leader tracking

    if (!silent && broadcastChannel.current && isMounted.current) {
      // Notify others we are stepping down (e.g., on unload)
      logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Broadcasting RELINQUISH_LEADER.`);
      broadcastChannel.current.postMessage({
        type: AuthChannelMessage.RELINQUISH_LEADER,
        tabId: tabId.current,
        timestamp: Date.now(),
      });
    }
     // Clear any pending claim timeout
     if (leadershipClaimTimeout.current) {
        clearTimeout(leadershipClaimTimeout.current);
        leadershipClaimTimeout.current = null;
     }
  }, [isLeader, stopHeartbeat]); // Dependency on isLeader state


  const claimLeadership = useCallback(() => {
    if (!isMounted.current || !broadcastChannel.current) return;
    logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Attempting to claim leadership. Current leader: ${leaderId.current}`);

    // Clear previous timeouts if any
    if (leadershipClaimTimeout.current) clearTimeout(leadershipClaimTimeout.current);
    stopHeartbeat(); // Stop heartbeating if we were leader before re-claiming

    // Optimistic immediate check - if no leader known or stored leader seems inactive, claim faster
    const knownLeader = leaderId.current;
    const lastSeen = knownLeader ? lastHeartbeatReceived.current[knownLeader] : 0;
    const isLeaderStale = !knownLeader || (Date.now() - lastSeen > LEADERSHIP_TIMEOUT * 1.5); // Leader hasn't been heard from

    if (isLeaderStale) {
        logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] No active leader detected or leader stale (${knownLeader}), attempting immediate claim.`);
        // Set ourselves as leader tentatively
        leaderId.current = tabId.current;
        setIsLeader(true);
        startHeartbeat();
        // Still broadcast claim to resolve potential conflicts
         broadcastChannel.current.postMessage({
           type: AuthChannelMessage.CLAIM_LEADER,
           tabId: tabId.current,
           timestamp: Date.now(),
         });
    } else {
        // Otherwise, broadcast claim and wait to see if contested
        logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Broadcasting CLAIM_LEADER and setting timeout.`);
        broadcastChannel.current.postMessage({
          type: AuthChannelMessage.CLAIM_LEADER,
          tabId: tabId.current,
          timestamp: Date.now(),
        });

        // Set a timeout to assume leadership if no one else claims strongly
        leadershipClaimTimeout.current = setTimeout(() => {
          if (isMounted.current && !leaderId.current) { // Only assume leadership if no leader was established during timeout
            logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Leadership claim uncontested after timeout. Assuming leadership.`);
            leaderId.current = tabId.current;
            setIsLeader(true);
            startHeartbeat();
          } else {
             logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Leadership claim timeout fired, but a leader (${leaderId.current}) already exists or component unmounted. Aborting assumption.`);
          }
        }, LEADERSHIP_TIMEOUT / 2); // Shorter timeout for claiming
    }

  }, [startHeartbeat, stopHeartbeat]);


  const handleBroadcastMessage = useCallback((event: MessageEvent) => {
    if (!isMounted.current) return;
    const data = event.data as AuthMessageData;
    const senderId = data.tabId;
    const messageType = data.type;
    const timestamp = data.timestamp;

    if (senderId === tabId.current) return; // Ignore messages from self

     // logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Received message: ${messageType} from ${senderId}`);

    // Track last seen time for all tabs
    lastHeartbeatReceived.current[senderId] = Date.now();


    switch (messageType) {
      case AuthChannelMessage.CLAIM_LEADER:
        // Another tab is claiming leadership
        logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Received CLAIM_LEADER from ${senderId}. Current leader: ${leaderId.current}`);
        const currentLeaderTimestamp = leaderId.current ? lastHeartbeatReceived.current[leaderId.current] || 0 : 0;

        // Simple conflict resolution: Tab with lexicographically smaller ID wins if claims are close, otherwise newest claim wins.
        // A more robust approach might involve multiple rounds or vector clocks.
        const currentlyLeader = leaderId.current === tabId.current;

        if (!leaderId.current || senderId < leaderId.current) {
           logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] New leader ${senderId} detected (or no previous leader). Relinquishing.`);
           leaderId.current = senderId;
           if (currentlyLeader) {
              relinquishLeadership(true); // Relinquish silently (don't broadcast relinquish)
           } else {
              setIsLeader(false); // Ensure we are not leader
              stopHeartbeat(); // Ensure heartbeat is stopped
           }
           // Cancel our pending claim timeout if active
            if (leadershipClaimTimeout.current) {
                logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Cancelling pending leadership claim due to claim from ${senderId}.`);
                clearTimeout(leadershipClaimTimeout.current);
                leadershipClaimTimeout.current = null;
            }
        } else if (senderId === leaderId.current) {
           // The current leader is just re-asserting. Update timestamp.
           logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Leader ${senderId} re-asserted claim.`);
           lastHeartbeatReceived.current[senderId] = Math.max(lastHeartbeatReceived.current[senderId] || 0, timestamp);
        } else {
            // Our ID is smaller than the claimant, or we are already leader. Ignore their claim for now.
            // Our heartbeat/next claim will re-assert our leadership if needed.
           logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Ignoring CLAIM_LEADER from ${senderId} (our ID ${tabId.current} is smaller or equal to current leader ${leaderId.current}).`);
        }
        break;

      case AuthChannelMessage.HEARTBEAT:
        // A leader is sending a heartbeat
        if (senderId === leaderId.current) {
            // logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Received HEARTBEAT from leader ${senderId}.`);
            // Update last seen time for the leader
            lastHeartbeatReceived.current[senderId] = Date.now();
        } else if (!leaderId.current || senderId < leaderId.current) {
            // A new leader emerged without a claim? Update our state.
            logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Received HEARTBEAT from unexpected leader ${senderId}. Accepting as new leader.`);
            leaderId.current = senderId;
             if (isLeader) { // If we thought we were leader
                 relinquishLeadership(true);
             } else {
                 setIsLeader(false);
                 stopHeartbeat();
             }
             // Cancel pending claim
             if (leadershipClaimTimeout.current) {
                 clearTimeout(leadershipClaimTimeout.current);
                 leadershipClaimTimeout.current = null;
             }
        }
        break;

      case AuthChannelMessage.RELINQUISH_LEADER:
        logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Received RELINQUISH_LEADER from ${senderId}.`);
        if (senderId === leaderId.current) {
          logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Current leader ${senderId} relinquished. Clearing leader.`);
          leaderId.current = null;
          setIsLeader(false); // Ensure we know we are not leader
          stopHeartbeat();
          // Optional: Automatically try to claim leadership if the leader steps down
          // claimLeadership();
        }
        // Clean up heartbeat tracker for the relinquishing tab
        delete lastHeartbeatReceived.current[senderId];
        break;
    }

     // Periodic cleanup of old tab heartbeats
     const now = Date.now();
     Object.keys(lastHeartbeatReceived.current).forEach(id => {
       if (now - lastHeartbeatReceived.current[id] > HEARTBEAT_INTERVAL * 5) { // Remove tabs not heard from in a while
         // logger.log(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Pruning stale heartbeat record for tab ${id}`);
         delete lastHeartbeatReceived.current[id];
         if (leaderId.current === id) {
            logger.warn(`[Leader][v${PROVIDER_VERSION}][${tabId.current}] Pruning STALE LEADER ${id}. Resetting leader state.`);
            leaderId.current = null;
             if (isLeader) { // If we thought we were leader
                 relinquishLeadership(true);
             } else {
                 setIsLeader(false);
                 stopHeartbeat();
             }
            // Maybe try to claim leadership now
            claimLeadership();
         }
       }
     });

  }, [isLeader, claimLeadership, relinquishLeadership, stopHeartbeat]); // Include isLeader here

  // --- Effect for Broadcast Channel & Leader Election Setup ---
  useEffect(() => {
    logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] Setting up BroadcastChannel and leader election.`);
    isMounted.current = true;

    if (!broadcastChannel.current) {
        logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] Creating BroadcastChannel: ${AUTH_CHANNEL_NAME}`);
        broadcastChannel.current = new BroadcastChannel(AUTH_CHANNEL_NAME);
        broadcastChannel.current.onmessage = handleBroadcastMessage;
    }

    // Attempt to claim leadership on mount/focus
    const handleFocus = () => {
        logger.log(`[Event][v${PROVIDER_VERSION}][${tabId.current}] Window focused.`);
        claimLeadership();
    };

    // Optional: Relinquish on blur? Can cause churn. Let timeouts handle inactivity.
    // const handleBlur = () => {
    //   logger.log(`[Event][v${PROVIDER_VERSION}][${tabId.current}] Window blurred.`);
    //   // Maybe relinquish if we are leader? Or just let heartbeat timeout?
    //   // if (isLeader) relinquishLeadership(true); // Silent relinquish
    // };

    const handleBeforeUnload = () => {
        logger.log(`[Event][v${PROVIDER_VERSION}][${tabId.current}] Window unloading.`);
        relinquishLeadership(false); // Broadcast relinquish
    };

    window.addEventListener('focus', handleFocus);
    // window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initial claim attempt shortly after mount
    const initialClaimTimeout = setTimeout(claimLeadership, 500); // Delay slightly

    // Cleanup
    return () => {
      logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}][${tabId.current}] Cleaning up leader election.`);
      isMounted.current = false;
      clearTimeout(initialClaimTimeout);
      if (leadershipClaimTimeout.current) clearTimeout(leadershipClaimTimeout.current);
      stopHeartbeat(); // Clear interval

       // Important: Broadcast relinquish on unmount only if we were the leader
       // handleBeforeUnload already covers browser close/refresh. This covers component unmount.
       if (leaderId.current === tabId.current) {
          relinquishLeadership(false); // Notify others we're gone
       }

      if (broadcastChannel.current) {
        logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}][${tabId.current}] Closing BroadcastChannel.`);
        broadcastChannel.current.close();
        broadcastChannel.current = null;
      }

      window.removeEventListener('focus', handleFocus);
      // window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}][${tabId.current}] Leader election cleanup complete.`);
    };
     // Add dependencies that trigger re-setup if they change (should be minimal)
  }, [claimLeadership, handleBroadcastMessage, relinquishLeadership, stopHeartbeat]);


  // --- Original useEffect for Auth State Changes ---
  useEffect(() => {
    logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] AuthProvider effect setup starting`);
    // Reset mount flag (might be redundant if outer effect handles it, but safe)
    // isMounted.current = true;
    initialCheckCompleted.current = false; // Reset on effect setup

    // ... (rest of the checkInitialSessionAndAdmin function - NO CHANGES needed inside it) ...
    const checkInitialSessionAndAdmin = async () => {
        // ... existing implementation ...
        // Note: This check runs independently in each tab on load.
    };

    logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] Setting up onAuthStateChange listener`);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
          // --- IMPORTANT ---
          // This listener reacts to the actual state change in localStorage,
          // which could have been triggered by *any* tab (ideally the leader).
          // All tabs (leader or not) should update their UI based on this event
          // to stay synchronized with the ground truth.
          logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Event received: ${event}, User: ${currentSession?.user?.id || 'none'}, Session: ${!!currentSession}. Is Leader: ${isLeader}`);

          // ... (rest of the onAuthStateChange handler - KEEP EXISTING LOGIC) ...
          // The logic for handling early events, processing after initial check,
          // username sync, setting state (setUser, setSession), and triggering
          // admin checks based on user changes should remain.
          // The leader election logic primarily controls *initiating* actions,
          // while this listener ensures all tabs *react* to the results.

           // --- Start of existing onAuthStateChange logic ---
            if (!initialCheckCompleted.current) {
                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Initial check NOT complete. Evaluating event: ${event}`);
                 if (event === 'SIGNED_OUT' && !sessionRef.current) {
                     logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Handling early SIGNED_OUT.`);
                     if (isMounted.current) {
                         logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Setting state: session=null, user=null, isAdmin=false, initialCheck=true, isLoading=false (early SIGNED_OUT)`);
                         setSession(null);
                         setUser(null);
                         setIsAdmin(false);
                         initialCheckCompleted.current = true;
                         setIsLoading(false);
                         if (sessionFallbackTimeout.current) {
                             clearTimeout(sessionFallbackTimeout.current);
                             sessionFallbackTimeout.current = null;
                         }
                     }
                     return;
                 }
                 else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && currentSession) {
                      logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Handling early ${event}. Processing immediately.`);
                      // ... (rest of early sign-in/session/refresh logic) ...
                       const userId = currentSession.user.id;
                       if (isMounted.current) {
                           logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Setting state: session=present, user=${userId}, initialCheck=true, isLoading=false (early ${event})`);
                           setSession(currentSession);
                           setUser(currentSession.user);
                           initialCheckCompleted.current = true;
                           setIsLoading(false);
                           if (sessionFallbackTimeout.current) {
                               clearTimeout(sessionFallbackTimeout.current);
                               sessionFallbackTimeout.current = null;
                           }
                           // Trigger non-blocking admin check...
                           if (!adminCheckInProgress.current) {
                              // ... (existing admin check logic) ...
                               adminCheckInProgress.current = true;
                               logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Starting ADMIN CHECK for user ${userId} (early ${event})`);
                               (async () => {
                                   const checkUserId = userId;
                                   try {
                                       const adminStatus = await checkIsAdmin(checkUserId);
                                       if (!isMounted.current) {
                                            logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK: Component unmounted during check for ${checkUserId} (early ${event}), aborting.`);
                                            adminCheckInProgress.current = false;
                                            return;
                                       }
                                       logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK result for ${checkUserId}: ${adminStatus} (early ${event})`);
                                       safeSetIsAdmin(checkUserId, adminStatus);
                                   } catch (adminError) {
                                       logger.error(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK: Error for ${checkUserId} (early ${event}):`, adminError);
                                       safeSetIsAdmin(checkUserId, false);
                                   } finally {
                                        adminCheckInProgress.current = false;
                                        if (isMounted.current) {
                                           logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK finished for ${checkUserId} (early ${event}).`);
                                        } else {
                                           logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK finished after unmount for ${checkUserId} (early ${event}).`);
                                        }
                                   }
                               })();
                           } else {
                              logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Admin check already in progress, skipping new check for ${userId} (early ${event}).`);
                           }
                       }
                      return;
                 }
                 else {
                    logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Deferring full processing of event: ${event} (waiting for initial check)`);
                    return;
                 }
            }

            logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Processing event ${event} (initial check complete)`);

            // --- Username Sync Check --- (Keep As Is)
            if (currentSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
              // ... existing username sync logic ...
              const userId = currentSession.user.id;
              const discordUsername = currentSession.user.user_metadata?.name;
              const discordUserId = currentSession.user.user_metadata?.provider_id;

              if (discordUsername || discordUserId) {
                 logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Checking Discord ID/Username sync for user ${userId}. Metadata values - ID: ${discordUserId}, Username: ${discordUsername}`);
                 // ... rest of sync logic ...
                 try {
                   const { data: profileData, error: profileError } = await supabase
                     .from('profiles')
                     .select('discord_user_id, discord_username')
                     .eq('id', userId)
                     .maybeSingle();

                   if (profileError) { /* ... */ }
                   else if (profileData) {
                      const updatePayload: { discord_user_id?: string; discord_username?: string } = {};
                      let needsUpdate = false;
                      if (discordUsername && profileData.discord_username !== discordUsername) { /* ... */ updatePayload.discord_username = discordUsername; needsUpdate = true; }
                      if (discordUserId && profileData.discord_user_id !== discordUserId) { /* ... */ updatePayload.discord_user_id = discordUserId; needsUpdate = true; }

                      if (needsUpdate) {
                          logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Updating profile for ${userId} with Discord fields:`, updatePayload);
                          const { error: updateError } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
                          if (updateError) { /* ... */ }
                          else { /* ... */ userProfileCache.delete(userId); }
                      } else { /* ... */ }
                   } else { /* ... */ }
                 } catch (syncError) { /* ... */ }
              } else { /* ... */ }
            }


            if (!isMounted.current) {
                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Component unmounted, ignoring event ${event}.`);
                return;
            }

            // --- State Update Logic --- (Keep As Is)
            const newUser = currentSession?.user || null;
            const oldUser = userRef.current;

            logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Setting state: session=${!!currentSession}, user=${newUser?.id || 'null'}`);
            setSession(currentSession);
            setUser(newUser);

             // --- Admin Check Logic (Post-Initial Check) --- (Keep As Is)
             if (!newUser) {
                 logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] No user in session, resetting admin status.`);
                 setIsAdmin(false);
             } else if (newUser.id !== oldUser?.id) {
                if (!adminCheckInProgress.current) {
                   adminCheckInProgress.current = true;
                   const userId = newUser.id;
                   logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] User changed (${oldUser?.id} -> ${userId}). Starting ADMIN CHECK.`);
                   (async () => {
                       const checkUserId = userId;
                       try {
                           const adminStatus = await checkIsAdmin(checkUserId);
                           if (!isMounted.current) { /* ... */ adminCheckInProgress.current = false; return; }
                           logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN CHECK result for ${checkUserId}: ${adminStatus}`);
                           safeSetIsAdmin(checkUserId, adminStatus);
                       } catch (adminError) { /* ... */ safeSetIsAdmin(checkUserId, false); }
                       finally { /* ... */ adminCheckInProgress.current = false; /* ... */ }
                   })();
                } else { /* ... */ }
             } else {
                logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] User unchanged (${newUser.id}), skipping admin check.`);
                 // ... (existing edge case re-check logic if isAdmin is undefined) ...
                  if (isAdmin === undefined && !adminCheckInProgress.current) {
                      logger.warn(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] User unchanged but isAdmin is undefined, attempting re-check.`);
                      adminCheckInProgress.current = true;
                      const userId = newUser.id;
                      (async () => {
                         const checkUserId = userId;
                         try {
                             const status = await checkIsAdmin(checkUserId);
                             logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] ADMIN RE-CHECK result for ${checkUserId}: ${status}`);
                             safeSetIsAdmin(checkUserId, status);
                         } catch (err) { /* ... */ safeSetIsAdmin(checkUserId, false); }
                         finally { /* ... */ adminCheckInProgress.current = false; /* ... */ }
                      })();
                  }
             }

            // Ensure loading is false... (Keep As Is)
            if (isLoading) {
                 logger.log(`[Auth Listener][v${PROVIDER_VERSION}][${tabId.current}] Setting isLoading=false (end of processing event ${event}).`);
                 setIsLoading(false);
                 if (sessionFallbackTimeout.current) {
                     clearTimeout(sessionFallbackTimeout.current);
                     sessionFallbackTimeout.current = null;
                 }
            }
            // --- End of existing onAuthStateChange logic ---
      }
    );

    // Initial check invocation (Keep As Is)
    logger.log(`[Effect Setup][v${PROVIDER_VERSION}][${tabId.current}] Invoking checkInitialSessionAndAdmin`);
    checkInitialSessionAndAdmin();

    // Fallback timeout (Keep As Is)
     if (sessionFallbackTimeout.current) { clearTimeout(sessionFallbackTimeout.current); }
     sessionFallbackTimeout.current = setTimeout(() => {
       if (isMounted.current && isLoading) {
         logger.warn(`[Timeout][v${PROVIDER_VERSION}][${tabId.current}] Initial session check exceeded ${LEADERSHIP_TIMEOUT}ms. Forcing isLoading=false`);
         setIsLoading(false);
         if (!initialCheckCompleted.current) {
           initialCheckCompleted.current = true;
         }
       }
     }, LEADERSHIP_TIMEOUT); // Use LEADERSHIP_TIMEOUT here too


    // Cleanup function (Keep As Is for auth subscription)
    return () => {
      logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}][${tabId.current}] Unsubscribing auth listener.`);
      // isMounted.current = false; // This is handled by the leader election effect cleanup
      subscription.unsubscribe();
      logger.log(`[Effect Cleanup][v${PROVIDER_VERSION}][${tabId.current}] Resetting adminCheckInProgress flag.`);
      adminCheckInProgress.current = false;
      if (sessionFallbackTimeout.current) {
        clearTimeout(sessionFallbackTimeout.current);
        sessionFallbackTimeout.current = null;
      }
    };
  // IMPORTANT: Minimal dependencies. This effect should run essentially once on mount.
  }, [isLeader, safeSetIsAdmin]); // Added isLeader dependency to log it correctly, safeSetIsAdmin for its definition

  // --- Modified Sign-in function ---
  const signIn = async (email: string, password: string) => {
     logger.log(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signIn attempt for ${email}. Is Leader: ${isLeader}`);
     if (!isLeader) {
       logger.warn(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signIn blocked: Not the leader tab.`);
       toast.info('Another tab is managing the session. Please sign in there.', { id: 'signin-blocked-toast' });
       return; // Don't proceed if not the leader
     }

    try {
      toast.loading('Signing in...', { id: 'signin-toast' });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      toast.dismiss('signin-toast');

      if (error) {
        logger.error(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signIn: Error for ${email}:`, error);
        throw error;
      }

      logger.log(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signIn: Successful for ${email}`);
      // Optional: Broadcast sign-in success? `onAuthStateChange` should handle it.
      // broadcastChannel.current?.postMessage({ type: AuthChannelMessage.ACTION_SIGN_IN, tabId: tabId.current, timestamp: Date.now() });
    } catch (error: any) {
      toast.dismiss('signin-toast');
      toast.error(error.message || 'Error signing in');
      logger.error(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signIn: Catch block error for ${email}:`, error);
    }
  };

  // --- Modified Sign-out function ---
  const signOut = async () => {
    logger.log(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signOut attempt. Is Leader: ${isLeader}`);
    if (!isLeader) {
      logger.warn(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signOut blocked: Not the leader tab.`);
       toast.info('Another tab is managing the session. Please sign out there.', { id: 'signout-blocked-toast' });
      return; // Don't proceed if not the leader
    }

    try {
      toast.loading('Signing out...', { id: 'signout-toast' });
      await supabase.auth.signOut();
      toast.dismiss('signout-toast');
      logger.log(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signOut: Successful`);
       // Optional: Broadcast sign-out success? `onAuthStateChange` should handle it.
       // broadcastChannel.current?.postMessage({ type: AuthChannelMessage.ACTION_SIGN_OUT, tabId: tabId.current, timestamp: Date.now() });
       // Explicitly relinquish leadership after sign out
       relinquishLeadership(false);
    } catch (error: any) {
      toast.dismiss('signout-toast');
      toast.error(error.message || 'Error signing out');
      logger.error(`[Auth Action][v${PROVIDER_VERSION}][${tabId.current}] signOut: Error:`, error);
    }
  };

  // Add safeSetIsAdmin definition (moved from within useEffect)
  /**
   * Safely update the isAdmin flag *only* if the component is still mounted **and**
   * the user has not changed since the async admin check was initiated. Prevents
   * a race where an admin check for an old user finishes after a new user has
   * logged in (or the original user has logged out), which could otherwise
   * leave the `isAdmin` state in the wrong value for the current user.
   */
  const safeSetIsAdmin = useCallback((userId: string | null | undefined, value: boolean) => {
    const currentUserId = userRef.current?.id;
    const checkUserId = userId || 'null_user_id_placeholder';

    if (isMounted.current && (currentUserId === checkUserId || currentUserId === null)) {
      logger.log(`[Admin Check][v${PROVIDER_VERSION}][${tabId.current}] safeSetIsAdmin: Updating isAdmin=${value} for user ${checkUserId}`);
      setIsAdmin(value);
    } else {
      logger.log(`[Admin Check][v${PROVIDER_VERSION}][${tabId.current}] safeSetIsAdmin: Skipped stale admin result for user ${checkUserId}. Current userRef: ${currentUserId}`);
    }
  }, []); // No dependencies needed as it uses refs


  useEffect(() => {
    userRef.current = user;
     logger.log(`[Ref Update][v${PROVIDER_VERSION}][${tabId.current}] User state updated in ref:`, user?.id || 'null');
  }, [user]);

  useEffect(() => {
    sessionRef.current = session;
    logger.log(`[Ref Update][v${PROVIDER_VERSION}][${tabId.current}] Session state updated in ref:`, session ? 'present' : 'null');
  }, [session]);


  logger.log(`[Render][v${PROVIDER_VERSION}][${tabId.current}] AuthProvider rendering. State: isLoading=${isLoading}, user=${user?.id || 'null'}, session=${!!session}, isAdmin=${isAdmin}, isLeader=${isLeader}, initialCheckCompleted=${initialCheckCompleted.current}, adminCheckInProgress=${adminCheckInProgress.current}`);

  // Provide the context value
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        isLoading,
        isLeader, // NEW: Expose leader status to consumers
        signIn,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

// Add import React, { ..., useCallback } from 'react';
// Add import { v4 as uuidv4 } from 'uuid';
// Potentially add // @ts-ignore for BroadcastChannel if types are missing initially