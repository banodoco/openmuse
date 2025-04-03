import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import { userProfileCache, userRolesCache } from './cache';

const logger = new Logger('AuthMethods');

export const signInWithDiscord = async () => {
  try {
    // Get the current URL to use as redirect
    let redirectUrl = `${window.location.origin}/auth/callback`;
    
    // Clear caches before signing in but maintain sessions
    logger.log('Cleaning up caches before Discord login');
    userProfileCache.clear();
    userRolesCache.clear();
    
    logger.log('Starting Discord sign in, redirect URL:', redirectUrl);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: redirectUrl,
        scopes: 'identify email guilds',
        skipBrowserRedirect: false,
        queryParams: {
          prompt: 'consent'
        }
      }
    });
    
    if (error) {
      logger.error('Error signing in with Discord:', error);
      throw error;
    }
    
    logger.log('Sign in with Discord initiated successfully', data);
    return data;
  } catch (error) {
    logger.error('Error in signInWithDiscord:', error);
    throw error;
  }
};

export const signOut = async () => {
  logger.log('Signing out');
  
  try {
    // Clear caches first
    userProfileCache.clear();
    userRolesCache.clear();
    
    // Sign out from Supabase globally
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logger.error('Error signing out:', error);
      throw error;
    }
    
    logger.log('Sign out successful');
    
    // Wait for auth state to update
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return true;
  } catch (error) {
    logger.error('Error in signOut:', error);
    throw error;
  }
};
