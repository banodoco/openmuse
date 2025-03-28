
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
    let authTimeout: NodeJS.Timeout | null = null;
    
    // Set timeout to prevent hanging on auth initialization
    authTimeout = setTimeout(() => {
      if (isMounted && isInitializing) {
        logger.warn('Auth initialization timed out, continuing with app render');
        setIsInitializing(false);
        if (onAuthStateChange) onAuthStateChange(false);
      }
    }, 3000);
    
    const setupAuth = async () => {
      try {
        logger.log('Setting up auth listeners');
        
        if (isMounted) onAuthStateChange(true);
        
        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          logger.log('Auth state changed:', event, session?.user?.id);
          
          // Update any global auth state
          if (session) {
            logger.log('Session available', session.user.id);
          } else {
            logger.log('No session available');
          }
        });
        
        // THEN check for existing session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error checking session:', error);
          throw error;
        }
        
        logger.log('Session check complete, has session:', !!data.session, data.session?.user?.id);
        
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
      } finally {
        if (authTimeout) {
          clearTimeout(authTimeout);
        }
      }
    };
    
    setupAuth();
    
    return () => {
      isMounted = false;
      if (authTimeout) clearTimeout(authTimeout);
    };
  }, [navigate, onAuthStateChange]);
  
  if (isInitializing) {
    return null; // Return null during initialization to avoid flickering
  }
  
  return <>{children}</>;
};

export default AuthProvider;
