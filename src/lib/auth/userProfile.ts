import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '../types';
import { Logger } from '../logger';
import { toast } from 'sonner';
import { signOut } from './authMethods';
import { userProfileCache, PROFILE_CACHE_TTL } from './cache';

const logger = new Logger('UserProfile');

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
      .maybeSingle();
    
    if (error) {
      logger.error('Error getting user profile:', error);
      userProfileCache.set(userId, {profile: null, timestamp: now});
      return null;
    }
    
    if (!data) {
      logger.warn(`User profile not found for authenticated user: ${userId}`);
      // Return null profile but don't force signout
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
