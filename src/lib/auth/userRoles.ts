import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';
import { userRolesCache, ROLES_CACHE_TTL } from './cache';

const logger = new Logger('UserRoles');

// Configurable timeout for admin role check (ms)
const ADMIN_CHECK_TIMEOUT_MS = 5000; // Reduced back to 5000

// Define the structure for cached data
interface CachedUserData {
  roles: string[];
  isAdmin?: boolean; // Optional: store admin status specifically
  timestamp: number;
}

export const getUserRoles = async (userId: string): Promise<string[]> => {
  // Check cache first
  const now = Date.now();
  // Explicitly cast type when getting from cache
  const cachedData = userRolesCache.get(userId) as CachedUserData | undefined;
  // Check if roles array exists and is valid
  if (cachedData && Array.isArray(cachedData.roles) && now - cachedData.timestamp < ROLES_CACHE_TTL) {
    return cachedData.roles;
  }
  
  try {
    // Query directly from user_roles table without ambiguous column references
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (error) {
      logger.error('Error getting user roles:', error);
      return [];
    }
    
    const roles = data.map(role => role.role);
    
    // Cache roles - Preserve isAdmin flag if it exists and is valid
    const existingAdminStatus = (cachedData && typeof cachedData.isAdmin === 'boolean' && now - cachedData.timestamp < ROLES_CACHE_TTL) 
                                ? cachedData.isAdmin 
                                : undefined;
    userRolesCache.set(userId, { roles, isAdmin: existingAdminStatus, timestamp: now });
    
    return roles;
  } catch (error) {
    logger.error('Error in getUserRoles:', error);
    return [];
  }
};

export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  logger.log(`[Admin Check][${userId}] Checking if user is admin`);
  const now = Date.now();

  // 1. Check Cache First
  const cachedData = userRolesCache.get(userId) as CachedUserData | undefined;
  if (cachedData && typeof cachedData.isAdmin === 'boolean' && now - cachedData.timestamp < ROLES_CACHE_TTL) {
    logger.log(`[Admin Check][${userId}] Cache hit: isAdmin = ${cachedData.isAdmin}`);
    return cachedData.isAdmin;
  }
  logger.log(`[Admin Check][${userId}] Cache miss or expired/incomplete.`);

  // 2. Perform Query if not cached or expired
  try {
    logger.log(`[Admin Check][${userId}] Starting Supabase query for admin check.`);

    const timeoutPromise = new Promise<never>((_, reject) => { // Use <never> for type safety
      setTimeout(() => reject(new Error(`Admin check timed out after ${ADMIN_CHECK_TIMEOUT_MS / 1000} seconds`)), ADMIN_CHECK_TIMEOUT_MS);
    });

    const queryStart = performance.now();
    logger.log(`[Admin Check][${userId}] Starting Supabase query race...`);

    // Define the query separately for clarity - use count for efficiency
    const query = supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true }) // Use head:true to only get count
      .eq('user_id', userId)
      .eq('role', 'admin');

    // Race between the actual query and the timeout
    // Destructure error and count directly from the response
    const { error, count } = await Promise.race([
      query,
      timeoutPromise
    ]);

    const queryDuration = (performance.now() - queryStart).toFixed(2);
    logger.log(`[Admin Check][${userId}] Supabase query race finished in ${queryDuration} ms. Result count: ${count}`);

    let isAdminResult = false; // Default to false

    if (error) {
      // Handle specific timeout error distinctly if needed, otherwise log generic error
      if (error.message.includes('timed out')) {
         logger.warn(`[Admin Check][${userId}] Query timed out.`);
         // Decide behaviour on timeout: return false or rethrow? Returning false is safer.
      } else {
         logger.error(`[Admin Check][${userId}] Supabase query error:`, error);
      }
      // Keep isAdminResult = false on error
    } else {
       // Check if count is greater than 0
       isAdminResult = count !== null && count > 0;
       logger.log(`[Admin Check][${userId}] Query successful: isAdmin = ${isAdminResult}`);
    }

    // 3. Update Cache
    // Preserve existing roles if they exist in cache and are valid
    const existingRoles = (cachedData && Array.isArray(cachedData.roles) && now - cachedData.timestamp < ROLES_CACHE_TTL) 
                          ? cachedData.roles 
                          : []; // Use empty array if roles aren't valid/present
    userRolesCache.set(userId, {
        roles: existingRoles,
        isAdmin: isAdminResult,
        timestamp: now
    });
    logger.log(`[Admin Check][${userId}] Updated cache with isAdmin = ${isAdminResult}`);

    return isAdminResult;

  } catch (error) {
    // Catch errors from Promise.race (like timeout) or other unexpected errors
    logger.error(`[Admin Check][${userId}] Error during admin check execution:`, error);
    return false; // Return false on any caught error
  }
};

export const addUserRole = async (userId: string, role: string): Promise<void> => {
  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role });
  
  if (error) {
    logger.error('Error adding user role:', error);
    throw error;
  }
  
  // Clear role cache for the user - this invalidates both roles and isAdmin flag
  userRolesCache.delete(userId);
  logger.log(`[UserRoles] Cleared cache for user ${userId} after adding role '${role}'.`);
};
