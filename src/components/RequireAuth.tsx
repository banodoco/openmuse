
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { checkIsAdmin } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
    // Always skip checking for special paths to prevent loops
    const shouldSkipCheck = 
      location.pathname === '/auth' || 
      location.pathname === '/auth/callback' ||
      location.pathname.startsWith('/assets/loras/');
    
    if (shouldSkipCheck) {
      console.log(`RequireAuth: Skipping check for ${location.pathname}`);
      setIsAuthorized(true);
      setIsChecking(false);
      return;
    }
    
    let isActive = true; // For cleanup to prevent state updates after unmount
    
    const checkAuth = async () => {
      try {
        if (!isActive) return;
        
        console.log('RequireAuth: Checking auth status');
        
        // Get current session directly
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user || null;
        
        if (!user) {
          console.log('RequireAuth: No user found in session');
          
          if (allowUnauthenticated) {
            console.log('RequireAuth: Allowing unauthenticated access');
            if (isActive) setIsAuthorized(true);
          } else {
            console.log('RequireAuth: Redirecting to auth');
            if (isActive) setIsAuthorized(false);
          }
          
          if (isActive) setIsChecking(false);
          return;
        }
        
        console.log('RequireAuth: User found in session:', user.id);
        
        if (requireAdmin) {
          console.log('RequireAuth: Admin check required');
          const isAdmin = await checkIsAdmin(user.id);
          
          if (!isAdmin) {
            console.log('RequireAuth: User is not an admin');
            toast.error('You do not have admin access');
          }
          
          if (isActive) setIsAuthorized(isAdmin);
        } else {
          if (isActive) setIsAuthorized(true);
        }
      } catch (error) {
        console.error('RequireAuth: Error checking authorization:', error);
        if (isActive) setIsAuthorized(false);
      } finally {
        if (isActive) setIsChecking(false);
      }
    };
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed in RequireAuth:', event, session?.user?.id);
        
        if (!isActive) return;
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setIsChecking(true);
          await checkAuth();
        } else if (event === 'SIGNED_OUT') {
          if (allowUnauthenticated) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
          setIsChecking(false);
        }
      }
    );
    
    // Then check auth status
    checkAuth();
    
    return () => {
      console.log('RequireAuth: Cleaning up');
      isActive = false;
      subscription.unsubscribe();
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
    console.log('Not authorized, redirecting to auth page');
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
