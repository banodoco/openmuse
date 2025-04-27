import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '../types';
import { Logger } from '../logger';
import { toast } from '@/hooks/use-toast';
import { userProfileCache, PROFILE_CACHE_TTL } from './cache';

const logger = new Logger('UserProfile');

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.error('Error getting session in getCurrentUserProfile:', sessionError);
      return null;
    }
    
    if (!session) {
      logger.log('No active session in getCurrentUserProfile');
      return null;
    }
    
    const userId = session.user.id;
    
    // Check cache first
    const now = Date.now();
    const cachedData = userProfileCache.get(userId);
    if (cachedData && now - cachedData.timestamp < PROFILE_CACHE_TTL) {
      logger.log('Returning cached user profile');
      return cachedData.profile;
    }
    
    // Check if user profile exists in database
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      logger.error('Error getting user profile:', error);
      // Don't clear cache or return null on temporary errors
      // Return cached data if available, even if expired
      if (cachedData) {
        logger.log('Returning expired cached profile due to database error');
        return cachedData.profile;
      }
      // Only set null if we have no cached data at all
      userProfileCache.set(userId, {profile: null, timestamp: now});
      return null;
    }
    
    if (!data) {
      logger.warn(`User profile not found for authenticated user: ${userId}`);
      userProfileCache.set(userId, {profile: null, timestamp: now});
      return null;
    }
    
    logger.log('Successfully retrieved user profile');
    userProfileCache.set(userId, {profile: data as UserProfile, timestamp: now});
    return data as UserProfile;
  } catch (error) {
    logger.error('Error in getCurrentUserProfile:', error);
    // Don't clear cache on error - be resilient
    return null;
  }
};

export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<UserProfile | null> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      toast({
        title: "Error",
        description: "You must be logged in to update your profile",
        variant: "destructive"
      });
      return null;
    }

    const userId = session.user.id;
    logger.log('Updating user profile:', userId, updates);

    // Check if username is unique if it's being updated
    if (updates.username) {
      // Validate username format/length client-side (already done in component)
      if (updates.username.length < 3) {
        // This check is redundant if component enforces it, but good for safety
        toast({
          title: "Error",
          description: "Username must be at least 3 characters long.",
          variant: "destructive"
        });
        return null;
      }

      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', updates.username) // Check username column
        .neq('id', userId)
        .limit(1);

      if (checkError) {
        logger.error('Error checking username uniqueness:', checkError);
        toast({
          title: "Error",
          description: "Failed to check if username is available",
          variant: "destructive"
        });
        return null;
      }

      if (existingUser && existingUser.length > 0) {
        toast({
          title: "Error",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive"
        });
        return null;
      }
    }

    // Remove discord_username and discord_user_id from updates object before saving,
    // as these should only be updated by the AuthProvider sync
    const { discord_username, discord_user_id, ...safeUpdates } = updates;

    // Create sanitized updates that includes all necessary properties
    // Use safeUpdates which excludes the discord fields
    const sanitizedUpdates: Partial<UserProfile> = { ...safeUpdates };

    // Sanitize links to ensure they are valid URLs
    if (safeUpdates.links) { // Check links in safeUpdates
      sanitizedUpdates.links = safeUpdates.links.filter(link => {
        try {
          // Make sure link has a protocol
          if (!/^https?:\/\//i.test(link)) {
            link = `https://${link}`;
          }
          new URL(link);
          return true;
        } catch (e) {
          return false;
        }
      });
    }

    // Perform the update using sanitizedUpdates
    const { data, error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates) // Use sanitizedUpdates
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user profile:', error);
      // Extract Supabase error details if available
      const errorMsg = error.message || "Failed to update profile";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    }

    // Clear cache
    userProfileCache.delete(userId);

    // Success toast is now handled in the component handleSubmit
    // toast({
    //   title: "Success",
    //   description: "Profile updated successfully",
    // });
    return data as UserProfile;
  } catch (error) {
    logger.error('Error in updateUserProfile:', error);
    toast({
      title: "Error",
      description: "An unexpected error occurred while updating your profile",
      variant: "destructive"
    });
    return null;
  }
};

// REVISED: Function to merge a preexisting profile based on discord user ID or username
export async function mergeProfileIfExists(supabaseClient: any, authUserId: string, identifiers: { discordUsername?: string, discordUserId?: string }) {
  const { discordUsername, discordUserId } = identifiers;
  let profileData = null;
  let queryError = null;

  logger.log(`Attempting merge for user ${authUserId} with identifiers:`, identifiers);

  // 1. Try to find by Discord User ID first (more reliable)
  if (discordUserId) {
    logger.log(`Searching for unclaimed profile with discord_user_id: ${discordUserId}`);
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('discord_user_id', discordUserId)
      .is('user_id', null)
      .single();
    
    // Ignore 'not found' error (PGRST116), store others
    if (error && error.code !== 'PGRST116') {
      logger.error(`Error querying by discord_user_id: ${discordUserId}`, error);
      queryError = error;
    } else if (data) {
      logger.log(`Found profile by discord_user_id: ${data.id}`);
      profileData = data;
    } else {
      logger.log(`No unclaimed profile found for discord_user_id: ${discordUserId}`);
    }
  }

  // 2. If not found by ID and no error occurred, try by Discord Username
  if (!profileData && !queryError && discordUsername) {
    logger.log(`Searching for unclaimed profile with username (Discord username): ${discordUsername}`);
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('username', discordUsername) // Assuming 'username' stores the Discord username
      .is('user_id', null)
      .single();

    // Ignore 'not found' error (PGRST116), store others
    if (error && error.code !== 'PGRST116') {
      logger.error(`Error querying by username: ${discordUsername}`, error);
      queryError = error;
    } else if (data) {
      logger.log(`Found profile by username: ${data.id}`);
      profileData = data;
    } else {
        logger.log(`No unclaimed profile found for username: ${discordUsername}`);
    }
  }

  // Handle any query errors that occurred
  if (queryError) {
    logger.error('Error occurred during profile search, cannot merge.', queryError);
    return null;
  }

  // 3. If a profile was found by either method, update and claim it
  if (profileData) {
    logger.log(`Found unclaimed profile (ID: ${profileData.id}) matching Discord identifiers, attempting merge.`);
    const updatePayload = {
      user_id: authUserId,
      status: 'active',
      // Optionally update username/discord_id if they were missing on the pre-created profile
      discord_user_id: profileData.discord_user_id ?? discordUserId,
      username: profileData.username ?? discordUsername
    };
    logger.log('Update payload for merge:', updatePayload);

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update(updatePayload)
      .eq('id', profileData.id);
      
    if (updateError) {
      logger.error(`Error merging profile ID: ${profileData.id}`, updateError);
      return null; // Failed to merge
    }
    logger.log(`Successfully merged profile ID: ${profileData.id} with user ID: ${authUserId}`);
    // Clear cache for the potentially updated profile (using its own ID if different from authUserId)
    userProfileCache.delete(profileData.id);
    // Also clear cache for the auth user ID, as their profile data might now exist/be different
    userProfileCache.delete(authUserId);
    return profileData; // Return the original profile data that was merged
  }

  // No unclaimed profile found matching the criteria
  logger.log('No matching unclaimed profile found for merge.');
  return null;
}
