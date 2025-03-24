
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
      redirectTo: redirectUrl,
      // Add explicit scopes to ensure we get the profile information
      scopes: 'identify email guilds',
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
  
  // Clear caches first in case the signOut fails
  userProfileCache.clear();
  userRolesCache.clear();
  
  // Sign out from Supabase
  const { error } = await supabase.auth.signOut({
    scope: 'global' // This ensures a complete sign out
  });
  
  if (error) {
    logger.error('Error signing out:', error);
    throw error;
  }
  
  logger.log('Sign out successful');
  
  // Clear any cached session data
  sessionStorage.clear();
  
  // Clear Supabase's local storage items
  // This ensures the auth state is completely reset
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      keysToRemove.push(key);
    }
  }
  
  // Remove each key in a separate loop to avoid index issues
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  
  // Wait briefly for auth state to update
  await new Promise(resolve => setTimeout(resolve, 200));
};
