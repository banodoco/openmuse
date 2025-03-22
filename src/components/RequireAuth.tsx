
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
    let isActive = true; // For cleanup
    let subscription: { unsubscribe: () => void; } | null = null;
    
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
    
    const checkAuth = async () => {
      try {
        if (!isActive) return;
        
        console.log('RequireAuth: Starting auth check');
        
        if (allowUnauthenticated) {
          console.log('RequireAuth: Allowing unauthenticated access');
          if (isActive) {
            setIsAuthorized(true);
            setIsChecking(false);
          }
          return;
        }
        
        // Get current session directly
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('RequireAuth: Error getting session:', error);
          if (isActive) {
            setIsAuthorized(allowUnauthenticated);
            setIsChecking(false);
          }
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
        
        if (isActive) setIsChecking(false);
      } catch (error) {
        console.error('RequireAuth: Error checking authorization:', error);
        if (isActive) {
          setIsAuthorized(allowUnauthenticated); 
          setIsChecking(false);
        }
      }
    };
    
    // Set up auth state listener first
    subscription = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed in RequireAuth:', event, session?.user?.id);
        
        if (!isActive) return;
        
        // For auth events, update auth state
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (requireAdmin) {
            const user = session?.user;
            if (user) {
              const isAdmin = await checkIsAdmin(user.id);
              if (isActive) setIsAuthorized(isAdmin);
            }
          } else {
            if (isActive) setIsAuthorized(true);
          }
          if (isActive) setIsChecking(false);
        } else if (event === 'SIGNED_OUT') {
          if (isActive) {
            setIsAuthorized(allowUnauthenticated);
            setIsChecking(false);
          }
        }
      }
    ).data.subscription;
    
    // Then check auth status
    checkAuth();
    
    return () => {
      console.log('RequireAuth: Cleaning up');
      isActive = false;
      if (subscription) subscription.unsubscribe();
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
