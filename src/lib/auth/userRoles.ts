import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';
import { userRolesCache, ROLES_CACHE_TTL } from './cache';

const logger = new Logger('UserRoles');

export const getUserRoles = async (userId: string): Promise<string[]> => {
  // Check cache first
  const now = Date.now();
  const cachedData = userRolesCache.get(userId);
  if (cachedData && now - cachedData.timestamp < ROLES_CACHE_TTL) {
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
    
    // Cache roles
    userRolesCache.set(userId, {roles, timestamp: now});
    
    return roles;
  } catch (error) {
    logger.error('Error in getUserRoles:', error);
    return [];
  }
};

export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  logger.log(`Checking if user ${userId} is admin`);
  
  try {
    logger.log(`Starting Supabase query for admin check: ${userId}`);
    
    // Create a promise that rejects after 5 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Admin check timed out after 5 seconds')), 5000);
    });

    // Race between the actual query and the timeout
    const response = await Promise.race([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle(),
      timeoutPromise
    ]) as any; // Type assertion needed because of the race

    logger.log(`Received response from Supabase for admin check: ${userId}`);
    
    if (response.error) {
      logger.error(`Supabase query error checking admin status for ${userId}:`, response.error);
      return false;
    }
    
    if (response.data) {
      logger.log(`Admin check successful for ${userId}: Found role data.`);
      return true;
    } else {
      logger.log(`Admin check successful for ${userId}: No admin role row found (data is null/empty).`);
      return false;
    }

  } catch (error) {
    // This will catch both timeout and query errors
    logger.error(`Error during admin check for ${userId}:`, error);
    return false;
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
  
  // Clear role cache
  userRolesCache.delete(userId);
};
