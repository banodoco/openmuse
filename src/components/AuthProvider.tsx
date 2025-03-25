
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';

const logger = new Logger('AuthProvider');

interface AuthProviderProps {
  children: React.ReactNode;
  onAuthStateChange: (isLoading: boolean) => void;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children, onAuthStateChange }) => {
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);
  
  useEffect(() => {
    let isMounted = true;
    
    const setupAuth = async () => {
      try {
        logger.log('Setting up auth listeners');
        
        if (isMounted) onAuthStateChange(true);
        
        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          logger.log('Auth state changed:', event, session?.user?.id);
          
          if (session) {
            logger.log('Storing session data for user:', session.user.id);
          } else {
            logger.log('No session available in auth state change');
          }
          
          if (event === 'SIGNED_OUT' && isMounted) {
            logger.log('User signed out, redirecting to auth');
            navigate('/auth');
          }
          
          if (event === 'SIGNED_IN' && isMounted) {
            logger.log('User signed in, session is present:', !!session);
            // No navigation here - let the callback handle it
          }
        });
        
        // THEN check for existing session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error checking session:', error);
          throw error;
        }
        
        logger.log('Session check complete, has session:', !!data.session, data.session?.user?.id);
        
        // LAST try refreshing the session if we have one
        if (data.session) {
          logger.log('Attempting to refresh existing session');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            logger.error('Error refreshing session:', refreshError);
          } else if (refreshData.session) {
            logger.log('Session refreshed successfully:', refreshData.session.user.id);
          }
        }
        
        if (isMounted) {
          onAuthStateChange(false);
          setIsInitializing(false);
        }
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        logger.error('Error in auth setup:', error);
        if (isMounted) {
          onAuthStateChange(false);
          setIsInitializing(false);
        }
        toast.error('Failed to check authentication status');
      }
    };
    
    setupAuth();
    
    return () => {
      isMounted = false;
    };
  }, [navigate, onAuthStateChange]);
  
  if (isInitializing) {
    return null;
  }
  
  return <>{children}</>;
};

export default AuthProvider;
