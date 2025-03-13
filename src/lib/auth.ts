
import { supabase } from './supabase';
import { UserProfile, UserRole } from './types';

export const signInWithDiscord = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
  
  if (error) {
    console.error('Error signing in with Discord:', error);
    throw error;
  }
  
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    throw error;
  }
  
  return session?.user || null;
};

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    return null;
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  
  if (error || !data) {
    console.error('Error getting user profile:', error);
    return null;
  }
  
  return data as UserProfile;
};

export const getUserRoles = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
  
  return data.map(role => role.role);
};

export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  const roles = await getUserRoles(userId);
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
};
