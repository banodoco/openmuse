
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';
import { toast } from 'sonner';
import { signOut } from './authMethods';

const logger = new Logger('CurrentUser');

export const getCurrentUser = async () => {
  try {
    logger.log('Getting current session');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logger.error('Error getting session:', error);
      return null;
    }
    
    if (!session?.user) {
      logger.log('No user in session');
      return null;
    }
    
    // Check if user still exists in the database
    const userId = session.user.id;
    logger.log('User found in session:', userId);
    
    // Instead of automatically signing out, we'll be more lenient
    // and just return the user from the session without forcing a logout
    const { data: userExists, error: userCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle(); // Using maybeSingle instead of single to avoid errors
    
    if (userCheckError) {
      logger.error('Error checking if user exists:', userCheckError);
      // Return the user anyway rather than forcing logout
      return session.user;
    }
    
    // Only log a warning if the profile doesn't exist but don't force logout
    if (!userExists) {
      logger.warn('User exists in auth but no profile found in database:', userId);
      // We'll still return the session user
    }
    
    return session.user;
  } catch (error) {
    logger.error('Error in getCurrentUser:', error);
    return null;
  }
};
