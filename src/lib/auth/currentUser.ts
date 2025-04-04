
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';

const logger = new Logger('CurrentUser');

export const getCurrentUser = async () => {
  try {
    const startTime = new Date().getTime();
    logger.log(`Getting current session at ${startTime}`);
    const { data: { session }, error } = await supabase.auth.getSession();
    
    const endTime = new Date().getTime();
    logger.log(`Session fetch completed in ${endTime - startTime}ms`);
    
    if (error) {
      logger.error('Error getting session:', error);
      return null;
    }
    
    if (!session?.user) {
      logger.log('No user in session');
      return null;
    }
    
    // Log session expiration details for debugging
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();
    const isExpired = expiresAt ? expiresAt < now : false;
    const timeUntilExpiry = expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000) : null;
    
    logger.log('User found in session:', {
      userId: session.user.id,
      expiresAt: expiresAt?.toISOString(),
      now: now.toISOString(),
      isExpired,
      timeUntilExpiry: timeUntilExpiry !== null ? `${timeUntilExpiry} seconds` : 'unknown',
      hasRefreshToken: !!session.refresh_token,
    });
    
    // Return the user directly without checking profile
    return session.user;
  } catch (error) {
    logger.error('Error in getCurrentUser:', error);
    return null;
  }
};

// Add a debug function to test token refresh
export const testSessionRefresh = async () => {
  try {
    logger.log('Testing session refresh');
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      logger.error('Error refreshing session:', error);
      return false;
    }
    
    logger.log('Session refresh successful:', {
      userId: data.session?.user.id,
      newExpiresAt: data.session ? new Date(data.session.expires_at! * 1000).toISOString() : null,
    });
    
    return true;
  } catch (error) {
    logger.error('Unexpected error in testSessionRefresh:', error);
    return false;
  }
};
