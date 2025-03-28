
import { supabase } from '../supabase';
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

export const getUserRoles = async (userId: string): Promise<string[]> => {
  // Check cache first
  const now = Date.now();
  const cachedData = userRolesCache.get(userId);
  if (cachedData && now - cachedData.timestamp < ROLES_CACHE_TTL) {
    return cachedData.roles;
  }
  
  try {
    // Query directly from user_roles table to avoid ambiguous column error
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
    // Use a direct query to check for admin role
    // Explicitly specify the table name for the user_id column to avoid ambiguity
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_roles.user_id', userId)
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
