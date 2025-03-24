
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
          
          if (event === 'SIGNED_OUT' && isMounted) {
            logger.log('User signed out, redirecting to auth');
            navigate('/auth');
          }
          
          // Force a storage sync to ensure session is properly stored
          if (event === 'SIGNED_IN' && typeof localStorage !== 'undefined') {
            logger.log('User signed in, session should be persisted');
          }
        });
        
        // THEN check for existing session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error checking session:', error);
          throw error;
        }
        
        logger.log('Session check complete, has session:', !!data.session);
        
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
