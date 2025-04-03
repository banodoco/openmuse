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
  
  let data = null; // Initialize data outside try block
  let error = null; // Initialize error outside try block

  try {
    // Use a direct query without the table name in the column reference
    const response = await supabase
      .from('user_roles')
      .select('role') // Only select necessary field
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
      
    data = response.data;
    error = response.error;

    if (error) {
      // Log the specific error object from Supabase
      logger.error(`Supabase query error checking admin status for ${userId}:`, error);
      return false; // Return false on query error
    }
    
    // Explicitly log the data received (or lack thereof)
    if (data) {
      logger.log(`Admin check successful for ${userId}: Found role data.`);
      return true; // User has the admin role
    } else {
      logger.log(`Admin check successful for ${userId}: No admin role row found (data is null/empty).`);
      return false; // User does not have the admin role row
    }

  } catch (catchError) {
    // Catch unexpected errors during the async operation itself
    logger.error(`Unexpected error during admin check for ${userId}:`, catchError);
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
