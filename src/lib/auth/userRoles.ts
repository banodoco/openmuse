
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
    // Use a direct query without the table name in the column reference
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
      
    if (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
    
    const isAdmin = !!data;
    logger.log(`User roles check result:`, isAdmin);
    return isAdmin;
  } catch (error) {
    logger.error('Error in admin check:', error);
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
