
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
  const [checkCount, setCheckCount] = useState(0); // Add counter to track repeated checks
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
    
    // Prevent infinite checking
    if (checkCount > 5) {
      console.error('RequireAuth: Too many authorization checks, forcing allowUnauthenticated access');
      setIsAuthorized(true);
      setIsChecking(false);
      return;
    }
    
    let isActive = true; // For cleanup to prevent state updates after unmount
    let timeout: number | null = null;
    
    const checkAuth = async () => {
      try {
        if (!isActive) return;
        
        console.log(`RequireAuth: Checking auth status (attempt ${checkCount + 1})`);
        setCheckCount(prev => prev + 1);
        
        // Get current session directly
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('RequireAuth: Error getting session:', error);
          if (isActive) setIsAuthorized(allowUnauthenticated);
          if (isActive) setIsChecking(false);
          return;
        }
        
        const user = session?.user || null;
        
        if (!user) {
          console.log('RequireAuth: No user found in session');
          
          if (allowUnauthenticated) {
            console.log('RequireAuth: Allowing unauthenticated access');
            if (isActive) setIsAuthorized(true);
          } else {
            console.log('RequireAuth: Not authorized, will redirect to auth');
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
        if (isActive) setIsAuthorized(allowUnauthenticated); // Fall back to allowUnauthenticated setting
      } finally {
        if (isActive) setIsChecking(false);
      }
    };
    
    // Set initial timeout to ensure we don't start checking until component is fully mounted
    timeout = window.setTimeout(() => {
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
      
      // Cleanup function will close this subscription
      if (isActive) {
        return () => {
          subscription.unsubscribe();
        };
      }
    }, 100);
    
    return () => {
      console.log('RequireAuth: Cleaning up');
      isActive = false;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [requireAdmin, allowUnauthenticated, location.pathname, checkCount]);

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
    console.log('Not authorized, redirecting to auth page from:', location.pathname);
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
