
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signInWithDiscord } from '@/lib/auth';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { supabase } from '@/lib/supabase';
import { Logger } from '@/lib/logger';

const logger = new Logger('Auth');

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // Check if user is already logged in
  useEffect(() => {
    let isActive = true; // For cleanup
    let timeoutId: NodeJS.Timeout | null = null;
    let subscription: { unsubscribe: () => void; } | null = null;
    
    // Set a timeout to avoid hanging on session check
    const sessionCheckTimeoutId = setTimeout(() => {
      if (isActive && isCheckingSession) {
        logger.log('Session check timed out, assuming no session');
        setIsCheckingSession(false);
      }
    }, 5000);
    
    // Listen for auth state changes FIRST
    subscription = supabase.auth.onAuthStateChange((event, session) => {
      logger.log('Auth state changed in Auth page:', event);
      
      if (!isActive) return;
      
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Clear any potential localStorage issues
        localStorage.removeItem('actual_auth_origin');
        
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        
        // Add a slight delay to ensure state is updated before navigation
        timeoutId = setTimeout(() => {
          if (isActive) {
            logger.log(`Auth page: Auth state changed, redirecting to ${returnUrl}`);
            navigate(returnUrl, { replace: true });
          }
        }, 500);
      }
    }).data.subscription;
    
    // THEN check for existing session
    const checkSession = async () => {
      try {
        logger.log('Auth page: Checking session');
        
        if (!isActive) return;
        
        // Try a session refresh first
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (!refreshError && refreshData.session) {
          logger.log('Auth page: Session refreshed, user is authenticated');
          const searchParams = new URLSearchParams(location.search);
          const returnUrl = searchParams.get('returnUrl') || '/';
          
          // Add a slight delay to ensure state is updated before navigation
          timeoutId = setTimeout(() => {
            if (isActive) {
              logger.log(`Auth page: Redirecting to ${returnUrl} after refresh`);
              navigate(returnUrl, { replace: true });
            }
          }, 500);
          return;
        }
        
        // Get the session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Auth page: Error checking session:', error);
          if (isActive) {
            setIsCheckingSession(false);
          }
          return;
        }
        
        if (session) {
          logger.log('Auth page: User already has session, redirecting');
          if (isActive) {
            const searchParams = new URLSearchParams(location.search);
            const returnUrl = searchParams.get('returnUrl') || '/';
            
            // Add a slight delay to ensure state is updated before navigation
            timeoutId = setTimeout(() => {
              if (isActive) {
                logger.log(`Auth page: Redirecting to ${returnUrl}`);
                navigate(returnUrl, { replace: true });
              }
            }, 500);
          }
        } else {
          logger.log('Auth page: No session found, showing login form');
          if (isActive) {
            setIsCheckingSession(false);
          }
        }
      } catch (error) {
        logger.error('Auth page: Error checking session:', error);
        if (isActive) {
          setIsCheckingSession(false);
        }
      } finally {
        if (sessionCheckTimeoutId) {
          clearTimeout(sessionCheckTimeoutId);
        }
      }
    };
    
    checkSession();
    
    return () => {
      logger.log('Auth page: Cleaning up');
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (sessionCheckTimeoutId) clearTimeout(sessionCheckTimeoutId);
      if (subscription) subscription.unsubscribe();
    };
  }, [navigate, location.search]);
  
  const handleDiscordSignIn = async () => {
    try {
      logger.log('Auth page: Starting Discord sign-in');
      setIsLoading(true);
      
      // Clear any potential localStorage issues
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase_auth_token');
      
      await signInWithDiscord();
      // Note: We don't need to navigate here as the redirect will happen automatically
    } catch (error) {
      logger.error('Error signing in with Discord:', error);
      toast.error('Failed to sign in with Discord');
      setIsLoading(false);
    }
  };
  
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p>Checking authentication status...</p>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-subtle space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Sign In</h1>
            <p className="text-muted-foreground">
              Sign in to VideoResponse to upload and react to videos
            </p>
          </div>
          
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={handleDiscordSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
            ) : (
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 127.14 96.36"
                fill="currentColor"
              >
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
            )}
            Sign in with Discord
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Auth;
