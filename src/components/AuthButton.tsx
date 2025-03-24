import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { signOut, getCurrentUserProfile } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { LogOut, LogIn, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logger } from '@/lib/logger';

const logger = new Logger('AuthButton');

const AuthButton: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    let isActive = true; // For cleanup
    let subscription: { unsubscribe: () => void; } | null = null;
    let sessionCheckTimeout: NodeJS.Timeout | null = null;
    
    // Set a timeout to avoid infinite loading state
    sessionCheckTimeout = setTimeout(() => {
      if (isActive && isLoading && !sessionChecked) {
        logger.warn('Session check timeout reached in AuthButton');
        setIsLoading(false);
        setSessionChecked(true);
      }
    }, 5000); // 5 second max wait
    
    // Set up auth state listener FIRST
    subscription = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('Auth state change in AuthButton:', event, session?.user?.id);
        
        if (!isActive) return;
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          try {
            setIsLoading(true);
            // Add a short delay to ensure the session is fully established
            await new Promise(resolve => setTimeout(resolve, 300));
            const profile = await getCurrentUserProfile();
            if (isActive) {
              setUser(profile);
              logger.log('User profile loaded after auth change:', profile?.username);
            }
          } catch (error) {
            logger.error('Error loading user profile after auth change:', error);
          } finally {
            if (isActive) {
              setIsLoading(false);
              setSessionChecked(true);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          if (isActive) {
            setUser(null);
            setIsLoading(false);
            setSessionChecked(true);
            logger.log('User signed out in AuthButton');
          }
        }
      }
    ).data.subscription;
    
    // THEN check for existing session
    const loadUserProfile = async () => {
      try {
        logger.log('AuthButton: Checking for existing session');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error getting session in AuthButton:', error);
          if (isActive) {
            setIsLoading(false);
            setSessionChecked(true);
          }
          return;
        }
        
        if (session?.user) {
          logger.log('AuthButton: Session found, loading profile for user:', session.user.id);
          try {
            // Add a short delay to ensure the session is fully established
            await new Promise(resolve => setTimeout(resolve, 300));
            const profile = await getCurrentUserProfile();
            if (isActive) {
              setUser(profile);
              logger.log('Profile loaded successfully:', profile?.username);
            }
          } catch (profileError) {
            logger.error('Error loading profile:', profileError);
          }
        } else {
          logger.log('AuthButton: No session found');
        }
      } catch (error) {
        logger.error('Error in loadUserProfile:', error);
      } finally {
        if (isActive) {
          setIsLoading(false);
          setSessionChecked(true);
        }
        
        if (sessionCheckTimeout) {
          clearTimeout(sessionCheckTimeout);
          sessionCheckTimeout = null;
        }
      }
    };
    
    loadUserProfile();
    
    return () => {
      logger.log('AuthButton: Cleaning up');
      isActive = false;
      if (subscription) subscription.unsubscribe();
      if (sessionCheckTimeout) clearTimeout(sessionCheckTimeout);
    };
  }, []);
  
  const handleSignIn = () => {
    navigate('/auth');
  };
  
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut();
      setUser(null);
      navigate('/');
    } catch (error) {
      logger.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Show loading state only during initial check to avoid flickering on refresh
  if (isLoading && !sessionChecked) {
    return (
      <Button variant="ghost" disabled className="animate-pulse">
        <div className="h-5 w-20 bg-muted rounded" />
      </Button>
    );
  }
  
  if (!user) {
    return (
      <Button 
        variant="outline" 
        onClick={handleSignIn}
        className="flex items-center gap-2"
      >
        <LogIn className="h-4 w-4" />
        Sign In
      </Button>
    );
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 border-2 shadow-sm hover:bg-secondary"
        >
          <User className="h-4 w-4" />
          {user.username || 'User'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSignOut} 
          className="text-destructive flex items-center cursor-pointer font-medium hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AuthButton;
