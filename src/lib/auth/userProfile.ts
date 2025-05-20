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
  let profileDataFromOldId = null; // Renamed to clarify it's the profile linked to the old ID
  let queryError = null;

  logger.log(`Attempting merge for user ${authUserId} with identifiers:`, identifiers);

  // 1. Try to find by Discord User ID first (more reliable)
  if (discordUserId) {
    logger.log(`Searching for unclaimed profile with discord_user_id: ${discordUserId}`);
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('discord_user_id', discordUserId)
      .neq('id', authUserId) // Ensure we don't match the user's own current profile
      .single();
    
    if (error && error.code !== 'PGRST116') { // Ignore 'not found' error
      logger.error(`Error querying by discord_user_id: ${discordUserId}`, error);
      queryError = error;
    } else if (data) {
      logger.log(`Found potential pre-existing profile (ID: ${data.id}) by discord_user_id`);
      profileDataFromOldId = data;
    } else {
      logger.log(`No unclaimed profile found for discord_user_id: ${discordUserId}`);
    }
  }

  // 2. If not found by ID and no error occurred, try by Discord Username
  if (!profileDataFromOldId && !queryError && discordUsername) {
    logger.log(`Searching for unclaimed profile with username (Discord username): ${discordUsername}`);
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('username', discordUsername)
      .neq('id', authUserId) // Ensure we don't match the user's own current profile
      .single();

    if (error && error.code !== 'PGRST116') { // Ignore 'not found' error
      logger.error(`Error querying by username: ${discordUsername}`, error);
      queryError = error;
    } else if (data) {
      logger.log(`Found potential pre-existing profile (ID: ${data.id}) by username`);
      profileDataFromOldId = data;
    } else {
        logger.log(`No unclaimed profile found for username: ${discordUsername}`);
    }
  }

  if (queryError) {
    logger.error('Error occurred during profile search, cannot merge.', queryError);
    return null;
  }

  // 3. If a potentially mergeable profile was found (and it's not the authUser's current profile)
  if (profileDataFromOldId && profileDataFromOldId.id !== authUserId) {
    const oldUserId = profileDataFromOldId.id;
    logger.log(`Pre-existing profile (ID: ${oldUserId}) found, attempting to merge data with primary user ID: ${authUserId}.`);

    try {
      const { data: rpcData, error: rpcError } = await supabaseClient.rpc('merge_user_data', {
        old_user_id: oldUserId,
        new_user_id: authUserId,
      });

      if (rpcError) {
        logger.error(`Error calling merge_user_data RPC for old_user_id ${oldUserId} and new_user_id ${authUserId}:`, rpcError);
        // Optionally, inform the user that the merge couldn't complete fully.
        toast({
          title: "Merge Incomplete",
          description: "Could not fully consolidate account data. Some older data might not be linked.",
          variant: "default"
        });
        return null; // Failed to merge
      }

      logger.log(`Successfully called merge_user_data RPC. Old profile ${oldUserId} merged into ${authUserId}. RPC response:`, rpcData);
      
      // Clear caches for both old and new user IDs as their data has changed.
      userProfileCache.delete(authUserId);
      userProfileCache.delete(oldUserId);

      // After merge, we should return the current, authoritative profile for authUserId.
      // The RPC function could return the updated new_user_id profile, or we can re-fetch.
      // For simplicity, let's assume the RPC handles attribute merging and we just need to ensure the current user's view is fresh.
      // The getCurrentUserProfile function will fetch the latest if cache is cleared.
      // Or, if rpcData contains the merged profile for new_user_id:
      if (rpcData && typeof rpcData === 'object' && rpcData.id === authUserId) {
        userProfileCache.set(authUserId, {profile: rpcData as UserProfile, timestamp: Date.now()});
        return rpcData as UserProfile;
      }
      // Fallback to fetching the updated profile if RPC doesn't return it directly in expected format.
      const updatedProfile = await getCurrentUserProfile(); // Relies on cache being cleared
      return updatedProfile;

    } catch (e) {
      logger.error(`Exception during merge_user_data RPC call or subsequent profile fetch:`, e);
      return null;
    }
  }

  if (profileDataFromOldId && profileDataFromOldId.id === authUserId) {
    logger.log(`Profile found (${profileDataFromOldId.id}) already matches authUserId (${authUserId}). No merge needed, but ensuring Discord data is up-to-date.`);
    // If the found profile is already the user's own, but we have new Discord identifiers,
    // we might want to update the existing profile's discord_user_id and discord_username.
    // This is typically handled by the AuthProvider sync logic upon login.
    // For now, mergeProfileIfExists focuses on merging distinct user ID records.
  }

  // No unclaimed profile found matching the criteria, or no merge was performed.
  logger.log('No merge operation performed.');
  return null; // Or return current user's profile if already fetched and no merge attempt was made.
}
