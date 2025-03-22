
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser, checkIsAdmin } from '@/lib/auth';
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
    // Don't check if we're already at the auth page to prevent loops
    if (location.pathname === '/auth' || location.pathname === '/auth/callback') {
      setIsChecking(false);
      setIsAuthorized(true); // Allow access to auth pages
      return;
    }
    
    // Check if path is a video page - these should always be accessible
    if (location.pathname.startsWith('/assets/loras/')) {
      console.log('Allowing access to video page without authentication');
      setIsAuthorized(true);
      setIsChecking(false);
      return;
    }
    
    const checkAuth = async () => {
      try {
        setIsChecking(true);
        
        // Get current session directly to avoid repeated calls to getCurrentUser
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user || null;
        
        if (!user) {
          console.log('No user found in session');
          
          if (allowUnauthenticated) {
            console.log('Allowing unauthenticated access');
            setIsAuthorized(true);
          } else {
            console.log('Redirecting to auth');
            setIsAuthorized(false);
          }
          
          setIsChecking(false);
          return;
        }
        
        console.log('User found in session:', user.id);
        
        if (requireAdmin) {
          console.log('Admin check required, checking if user is admin');
          const isAdmin = await checkIsAdmin(user.id);
          
          if (!isAdmin) {
            console.log('User is not an admin');
            toast.error('You do not have admin access');
          }
          
          setIsAuthorized(isAdmin);
        } else {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error('Error checking authorization:', error);
        setIsAuthorized(false);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkAuth();
    
    // Set up auth state listener to respond to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          checkAuth();
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
    
    return () => {
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
  if (isAuthorized === false && !location.pathname.startsWith('/auth')) {
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
