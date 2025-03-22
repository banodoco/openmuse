
import { supabase } from './supabase';
import { UserProfile, UserRole } from './types';
import { Logger } from './logger';
import { toast } from 'sonner';

const logger = new Logger('Auth');

export const signInWithDiscord = async () => {
  // Get the current URL but replace 'localhost:3000' with the actual origin if needed
  let redirectUrl = `${window.location.origin}/auth/callback`;
  
  // If we're in development and using localhost, add a fallback for when
  // Supabase redirects to localhost:3000 instead of our actual URL
  if (!window.location.origin.includes('localhost:3000')) {
    logger.log('Setting up for potential localhost redirect...');
    // Store the actual origin to check for it in Auth.tsx
    localStorage.setItem('actual_auth_origin', window.location.origin);
  }
  
  logger.log('Sign in with Discord, redirect URL:', redirectUrl);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: redirectUrl
    }
  });
  
  if (error) {
    logger.error('Error signing in with Discord:', error);
    throw error;
  }
  
  return data;
};

export const signOut = async () => {
  logger.log('Signing out');
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    logger.error('Error signing out:', error);
    throw error;
  }
  
  logger.log('Sign out successful');
  
  // Clear any cached session data
  sessionStorage.clear();
  localStorage.removeItem('sb-ujlwuvkrxlvoswwkerdf-auth-token');
  
  // Clear caches
  userProfileCache.clear();
  userRolesCache.clear();
  
  // Give the system time to process the sign out event
  await new Promise(resolve => setTimeout(resolve, 100));
};

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

// Cache for user profiles to reduce database queries
const userProfileCache = new Map<string, {profile: UserProfile | null, timestamp: number}>();
const PROFILE_CACHE_TTL = 60000; // 1 minute

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

// Cache for user roles to reduce database queries
const userRolesCache = new Map<string, {roles: string[], timestamp: number}>();
const ROLES_CACHE_TTL = 300000; // 5 minutes

export const getUserRoles = async (userId: string): Promise<string[]> => {
  // Check cache first
  const now = Date.now();
  const cachedData = userRolesCache.get(userId);
  if (cachedData && now - cachedData.timestamp < ROLES_CACHE_TTL) {
    return cachedData.roles;
  }
  
  try {
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
  const roles = await getUserRoles(userId);
  logger.log(`User roles:`, roles);
  return roles.includes('admin');
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
