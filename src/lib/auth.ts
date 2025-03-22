import { supabase } from './supabase';
import { UserProfile, UserRole } from './types';

export const signInWithDiscord = async () => {
  // Get the current URL but replace 'localhost:3000' with the actual origin if needed
  let redirectUrl = `${window.location.origin}/auth/callback`;
  
  // If we're in development and using localhost, add a fallback for when
  // Supabase redirects to localhost:3000 instead of our actual URL
  if (!window.location.origin.includes('localhost:3000')) {
    console.log('Auth: Setting up for potential localhost redirect...');
    // Store the actual origin to check for it in Auth.tsx
    localStorage.setItem('actual_auth_origin', window.location.origin);
  }
  
  console.log('Auth: Sign in with Discord, redirect URL:', redirectUrl);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: redirectUrl
    }
  });
  
  if (error) {
    console.error('Auth: Error signing in with Discord:', error);
    throw error;
  }
  
  return data;
};

export const signOut = async () => {
  console.log('Auth: Signing out');
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Auth: Error signing out:', error);
    throw error;
  }
  
  console.log('Auth: Sign out successful');
};

export const getCurrentUser = async () => {
  try {
    console.log('Auth: Getting current session');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth: Error getting session:', error);
      return null;
    }
    
    if (session?.user) {
      console.log('Auth: User found in session:', session.user.id);
    } else {
      console.log('Auth: No user in session');
    }
    
    return session?.user || null;
  } catch (error) {
    console.error('Auth: Error in getCurrentUser:', error);
    return null;
  }
};

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
    
    return data as UserProfile;
  } catch (error) {
    console.error('Error in getCurrentUserProfile:', error);
    return null;
  }
};

export const getUserRoles = async (userId: string): Promise<string[]> => {
  // Cache user roles in memory to avoid excessive calls
  const cacheKey = `user_roles_${userId}`;
  const cachedRoles = sessionStorage.getItem(cacheKey);
  
  if (cachedRoles) {
    try {
      return JSON.parse(cachedRoles);
    } catch (e) {
      console.error('Error parsing cached roles:', e);
    }
  }
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
  
  const roles = data.map(role => role.role);
  
  // Cache roles for 5 minutes
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(roles));
  } catch (e) {
    console.error('Error caching roles:', e);
  }
  
  return roles;
};

export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  console.log(`Checking if user ${userId} is admin`);
  const roles = await getUserRoles(userId);
  console.log(`User roles:`, roles);
  return roles.includes('admin');
};

export const addUserRole = async (userId: string, role: string): Promise<void> => {
  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role });
  
  if (error) {
    console.error('Error adding user role:', error);
    throw error;
  }
  
  // Clear role cache
  sessionStorage.removeItem(`user_roles_${userId}`);
};
