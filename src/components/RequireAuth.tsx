
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { checkIsAdmin, getCurrentUser, signOut } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';

const logger = new Logger('RequireAuth');

interface RequireAuthProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowUnauthenticated?: boolean;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  requireAdmin = false,
  allowUnauthenticated = false
}) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let isActive = true;
    let authCheckTimeout: NodeJS.Timeout | null = null;
    let subscription: { unsubscribe: () => void; } | null = null;
    
    // Always skip checking for special paths to prevent loops
    const shouldSkipCheck = 
      location.pathname === '/auth' || 
      location.pathname === '/auth/callback' ||
      location.pathname === '/upload' ||  // Allow uploads without authentication
      location.pathname.startsWith('/assets/loras/');
    
    if (shouldSkipCheck) {
      logger.log(`RequireAuth: Skipping check for ${location.pathname}`);
      setIsAuthorized(true);
      setIsChecking(false);
      return () => {}; // Empty cleanup for skipped routes
    }
    
    // Set up auth state listener FIRST
    subscription = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('Auth state changed in RequireAuth:', event, session?.user?.id);
        
        if (!isActive) return;
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          try {
            const user = session?.user;
            if (user) {
              // Check if user still exists in database
              const { data: userExists, error: userCheckError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .single();
              
              if (userCheckError || !userExists) {
                logger.error('User no longer exists in database, signing out');
                toast.error('Your session is no longer valid. Please sign in again.');
                await signOut();
                if (isActive) {
                  setIsAuthorized(allowUnauthenticated);
                  setIsChecking(false);
                }
                return;
              }
              
              if (requireAdmin) {
                const isAdmin = await checkIsAdmin(user.id);
                if (!isAdmin) {
                  logger.log('User is not an admin');
                  toast.error('You do not have admin access');
                }
                if (isActive) setIsAuthorized(isAdmin);
              } else {
                if (isActive) setIsAuthorized(true);
              }
            }
          } catch (error) {
            logger.error('Error in auth state change handler:', error);
            if (isActive) setIsAuthorized(allowUnauthenticated);
          } finally {
            if (isActive) setIsChecking(false);
          }
        } else if (event === 'SIGNED_OUT') {
          if (isActive) {
            setIsAuthorized(allowUnauthenticated);
            setIsChecking(false);
          }
        }
      }
    ).data.subscription;
    
    // THEN check for existing session with a timeout to avoid hanging
    const checkAuth = async () => {
      try {
        if (!isActive) return;
        
        logger.log('RequireAuth: Starting auth check');
        
        if (allowUnauthenticated) {
          logger.log('RequireAuth: Allowing unauthenticated access');
          if (isActive) {
            setIsAuthorized(true);
            setIsChecking(false);
          }
          return;
        }
        
        // Get current session with a timeout to avoid hanging
        authCheckTimeout = setTimeout(() => {
          if (isActive && isChecking) {
            logger.error('Auth check timed out, allowing access based on unauthenticated setting');
            setIsAuthorized(allowUnauthenticated);
            setIsChecking(false);
          }
        }, 5000); // 5 second timeout for auth check
        
        try {
          const user = await getCurrentUser();
          
          if (!user) {
            logger.log('RequireAuth: No user found in session');
            
            if (allowUnauthenticated) {
              logger.log('RequireAuth: Allowing unauthenticated access');
              if (isActive) setIsAuthorized(true);
            } else {
              logger.log('RequireAuth: Not authorized, will redirect to auth');
              if (isActive) setIsAuthorized(false);
            }
            
            if (isActive) setIsChecking(false);
            return;
          }
          
          logger.log('RequireAuth: User found in session:', user.id);
          
          if (requireAdmin) {
            logger.log('RequireAuth: Admin check required');
            const isAdmin = await checkIsAdmin(user.id);
            
            if (!isAdmin) {
              logger.log('RequireAuth: User is not an admin');
              toast.error('You do not have admin access');
            }
            
            if (isActive) setIsAuthorized(isAdmin);
          } else {
            if (isActive) setIsAuthorized(true);
          }
        } catch (error) {
          logger.error('RequireAuth: Error in auth check:', error);
          if (isActive) setIsAuthorized(allowUnauthenticated);
        } finally {
          // Clear timeout if auth check completes
          if (authCheckTimeout) {
            clearTimeout(authCheckTimeout);
            authCheckTimeout = null;
          }
          
          if (isActive) setIsChecking(false);
        }
      } catch (error) {
        logger.error('RequireAuth: Error checking authorization:', error);
        if (isActive) {
          setIsAuthorized(allowUnauthenticated); 
          setIsChecking(false);
        }
      }
    };
    
    // Run auth check
    checkAuth();
    
    return () => {
      logger.log('RequireAuth: Cleaning up');
      isActive = false;
      if (subscription) subscription.unsubscribe();
      if (authCheckTimeout) clearTimeout(authCheckTimeout);
    };
  }, [requireAdmin, allowUnauthenticated, location.pathname]);

  // Only show loading state during initial check
  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">Checking authorization...</h1>
      </div>
    );
  }

  // If not authorized and not on the auth page, redirect
  if (isAuthorized === false) {
    logger.log('Not authorized, redirecting to auth page from:', location.pathname);
    // Redirect to auth page with return URL
    return (
      <Navigate 
        to={`/auth?returnUrl=${encodeURIComponent(location.pathname)}`} 
        replace 
      />
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
