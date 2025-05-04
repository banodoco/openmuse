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
      .eq('username', discordUsername)
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

  // 3. If a profile was found by either method, handle potential conflict and claim it
  if (profileData) {
    logger.log(`Found pre-existing profile (ID: ${profileData.id}) matching Discord identifiers.`);

    // Check if a default profile was already created for the auth user
    const { data: existingAuthProfile, error: checkError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle();

    if (checkError) {
      logger.error(`Error checking for existing profile for auth user ${authUserId}:`, checkError);
      return null; // Cannot safely proceed
    }

    // If a default profile exists AND it's different from the one we found
    if (existingAuthProfile && existingAuthProfile.id !== profileData.id) {
      logger.warn(`Default profile (ID: ${existingAuthProfile.id}) found for new auth user. Deleting it to merge with pre-existing profile (ID: ${profileData.id}).`);
      const { error: deleteError } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', existingAuthProfile.id);

      if (deleteError) {
        logger.error(`Error deleting default profile (ID: ${existingAuthProfile.id}):`, deleteError);
        // Decide how to handle: maybe try merging anyway, or fail?
        // Failing safer to avoid potential inconsistent state or duplicate errors later
        return null; 
      }
      logger.log(`Successfully deleted default profile (ID: ${existingAuthProfile.id}).`);
    }

    // Now, update the pre-existing profile to claim it
    logger.log(`Attempting to update pre-existing profile ID ${profileData.id} to use auth ID ${authUserId}.`);
    const updatePayload = {
      id: authUserId, // <--- This is the key update: change the ID
      status: 'active',
      // Ensure Discord IDs/usernames are consistent
      discord_user_id: discordUserId || profileData.discord_user_id, // Prefer ID from auth session
      discord_username: discordUsername || profileData.discord_username // Prefer username from auth session
    };
    logger.log('Update payload for merge:', updatePayload);

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update(updatePayload)
      .eq('id', profileData.id); // Target the original ID for the update
      
    if (updateError) {
      logger.error(`Error updating profile ID ${profileData.id} to ${authUserId}:`, updateError);
      // Check for specific errors, e.g., if the authUserId already exists despite our check (race condition?)
      if (updateError.code === '23505') { // unique_violation - likely means the default profile deletion failed or didn't happen in time
         logger.error(`Merge failed due to unique constraint violation - possible race condition or failed deletion of default profile.`);
      } else {
         logger.error(`Generic error during profile merge update.`);
      }
      return null; // Failed to merge
    }

    logger.log(`Successfully updated profile ID: ${profileData.id} to ${authUserId}`);
    // Clear cache for the potentially updated profile (using its *original* ID might be needed if deletion failed, but using new ID is better)
    userProfileCache.delete(authUserId); 
    // Also clear cache for the *original* ID if it was different, just in case
    if (profileData.id !== authUserId) {
       userProfileCache.delete(profileData.id);
    }
    return { ...profileData, ...updatePayload }; // Return the conceptually merged profile data
  }

  // No unclaimed profile found matching the criteria
  logger.log('No matching unclaimed profile found for merge.');
  return null;
}
