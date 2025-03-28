
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '../types';
import { Logger } from '../logger';
import { toast } from 'sonner';
import { signOut } from './authMethods';
import { userProfileCache, userRolesCache, PROFILE_CACHE_TTL, ROLES_CACHE_TTL } from './cache';

const logger = new Logger('UserManagement');

export const getCurrentUser = async () => {
  try {
    logger.log('Getting current session');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logger.error('Error getting session:', error);
      return null;
    }
    
    if (!session?.user) {
      logger.log('No user in session');
      return null;
    }
    
    // Check if user still exists in the database
    const userId = session.user.id;
    logger.log('User found in session:', userId);
    
    // Verify the user still exists
    const { data: userExists, error: userCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userCheckError || !userExists) {
      logger.error('User no longer exists in database:', userCheckError || 'No profile found');
      logger.log('Signing out invalid user');
      
      // Sign the user out as they no longer exist in the database
      toast.error('Your session is no longer valid. Please sign in again.');
      await signOut();
      return null;
    }
    
    return session.user;
  } catch (error) {
    logger.error('Error in getCurrentUser:', error);
    return null;
  }
};

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return null;
    }
    
    const userId = session.user.id;
    
    // Check cache first
    const now = Date.now();
    const cachedData = userProfileCache.get(userId);
    if (cachedData && now - cachedData.timestamp < PROFILE_CACHE_TTL) {
      return cachedData.profile;
    }
    
    // Check if user still exists in database
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      logger.error('Error getting user profile:', error);
      
      // If user profile doesn't exist, sign them out
      if (error.code === 'PGRST116') {
        logger.log('User profile not found, signing out');
        toast.error('Your account information could not be found. Please sign in again.');
        await signOut();
      }
      
      userProfileCache.set(userId, {profile: null, timestamp: now});
      return null;
    }
    
    userProfileCache.set(userId, {profile: data as UserProfile, timestamp: now});
    return data as UserProfile;
  } catch (error) {
    logger.error('Error in getCurrentUserProfile:', error);
    userProfileCache.clear();
    return null;
  }
};

export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<UserProfile | null> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      toast.error('You must be logged in to update your profile');
      return null;
    }
    
    const userId = session.user.id;
    logger.log('Updating user profile:', userId, updates);
    
    // Check if display_name is unique if it's being updated
    if (updates.display_name) {
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('display_name', updates.display_name)
        .neq('id', userId)
        .limit(1);
      
      if (existingUser && existingUser.length > 0) {
        toast.error('This display name is already taken');
        return null;
      }
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating user profile:', error);
      toast.error('Failed to update profile');
      return null;
    }
    
    // Clear cache
    userProfileCache.delete(userId);
    
    toast.success('Profile updated successfully');
    return data as UserProfile;
  } catch (error) {
    logger.error('Error in updateUserProfile:', error);
    toast.error('An error occurred while updating your profile');
    return null;
  }
};

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
