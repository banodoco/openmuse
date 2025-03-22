
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser, checkIsAdmin } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RequireAuthProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsChecking(true);
        const user = await getCurrentUser();
        
        if (!user) {
          console.log('No user found, redirecting to auth');
          setIsAuthorized(false);
          setIsChecking(false);
          return;
        }
        
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
    
    // Don't check if we're already at the auth page to prevent loops
    if (location.pathname === '/auth') {
      setIsChecking(false);
      setIsAuthorized(true); // Allow access to auth page
    } else {
      checkAuth();
    }
  }, [requireAdmin, location.pathname]);

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
  if (isAuthorized === false && location.pathname !== '/auth') {
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
