
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';
import { userProfileCache, userRolesCache } from './cache';

const logger = new Logger('AuthMethods');

export const signInWithDiscord = async () => {
  try {
    // Get the current URL to use as redirect
    let redirectUrl = `${window.location.origin}/auth/callback`;
    
    // Clear caches before signing in
    logger.log('Cleaning up caches before Discord login');
    userProfileCache.clear();
    userRolesCache.clear();
    
    // Force a sign out to ensure a clean slate
    try {
      await supabase.auth.signOut({ scope: 'local' });
      // Allow time for sign out to complete
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (signOutError) {
      logger.log('Ignoring error during preventative sign out:', signOutError);
    }
    
    // Clear any localStorage lingering tokens manually
    try {
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase_auth_token');
      localStorage.removeItem('actual_auth_origin');
    } catch (e) {
      logger.log('Error clearing localStorage items:', e);
    }
    
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
    
    // Manually clear any localStorage tokens to ensure complete cleanup
    try {
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase_auth_token');
      localStorage.removeItem('actual_auth_origin');
    } catch (e) {
      logger.log('Error clearing localStorage items during signOut:', e);
    }
    
    // Sign out from Supabase with global scope to clear all sessions
    const { error } = await supabase.auth.signOut({
      scope: 'global'
    });
    
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
