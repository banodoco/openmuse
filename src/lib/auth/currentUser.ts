
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
    
    // Verify the user still exists
    const { data: userExists, error: userCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userCheckError || !userExists) {
      logger.error('User no longer exists in database:', userCheckError || 'No profile found');
      logger.log('Signing out invalid user');
      
      // Sign the user out as they no longer exist in the database
      toast.error('Your session is no longer valid. Please sign in again.');
      await signOut();
      return null;
    }
    
    return session.user;
  } catch (error) {
    logger.error('Error in getCurrentUser:', error);
    return null;
  }
};
