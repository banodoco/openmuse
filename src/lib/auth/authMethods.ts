
import { supabase } from '../supabase';
import { Logger } from '../logger';
import { userProfileCache, userRolesCache } from './cache';

const logger = new Logger('AuthMethods');

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
