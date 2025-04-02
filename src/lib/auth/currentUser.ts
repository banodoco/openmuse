
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '../logger';

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
    
    // Return the user directly without checking profile
    // This prevents unnecessary signouts if profile doesn't exist
    logger.log('User found in session:', session.user.id);
    return session.user;
  } catch (error) {
    logger.error('Error in getCurrentUser:', error);
    return null;
  }
};
