
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
    const setupAuth = async () => {
      try {
        logger.log('Setting up auth listeners');
        
        onAuthStateChange(true);
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          logger.log('Auth state changed:', event);
          
          if (event === 'SIGNED_OUT') {
            logger.log('User signed out, redirecting to auth');
            navigate('/auth');
          }
        });
        
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error checking session:', error);
          throw error;
        }
        
        logger.log('Session check complete, has session:', !!data.session);
        
        onAuthStateChange(false);
        setIsInitializing(false);
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        logger.error('Error in auth setup:', error);
        onAuthStateChange(false);
        setIsInitializing(false);
        toast.error('Failed to check authentication status');
      }
    };
    
    setupAuth();
  }, [navigate, onAuthStateChange]);
  
  if (isInitializing) {
    return null;
  }
  
  return <>{children}</>;
};

export default AuthProvider;
