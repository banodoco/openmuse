
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { checkIsAdmin } from '@/lib/auth';

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
  const { user, isLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckComplete, setAdminCheckComplete] = useState(!requireAdmin);
  const location = useLocation();
  
  // Skip checking for certain public pages
  const shouldSkipCheck = 
    location.pathname === '/auth' || 
    location.pathname === '/auth/callback' ||
    location.pathname === '/upload' ||
    location.pathname.startsWith('/assets/loras/');
  
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Check admin status if required
    const verifyAdminStatus = async () => {
      // Only check admin status if user is authenticated and it's required
      if (user && requireAdmin) {
        try {
          logger.log('Checking admin status for user:', user.id);
          const isUserAdmin = await checkIsAdmin(user.id);
          
          if (isMounted) {
            setIsAdmin(isUserAdmin);
            setAdminCheckComplete(true);
            
            if (!isUserAdmin) {
              logger.log('User is not an admin');
              toast.error('You do not have admin access');
            }
          }
        } catch (error) {
          logger.error('Error checking admin status:', error);
          if (isMounted) {
            setIsAdmin(false);
            setAdminCheckComplete(true);
          }
        }
      } else if (requireAdmin) {
        // If no user but admin required, set isAdmin to false
        if (isMounted) {
          setIsAdmin(false);
          setAdminCheckComplete(true);
        }
      }
    };
    
    // Set a timeout to prevent hanging on admin check
    if (requireAdmin && !adminCheckComplete) {
      timeoutId = setTimeout(() => {
        if (isMounted && !adminCheckComplete) {
          logger.warn('Admin check timed out, assuming not admin');
          setIsAdmin(false);
          setAdminCheckComplete(true);
        }
      }, 5000);
    }
    
    verifyAdminStatus();
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, requireAdmin, adminCheckComplete]);
  
  // Skip checks for certain paths
  if (shouldSkipCheck) {
    logger.log(`Skipping auth check for path: ${location.pathname}`);
    return <>{children}</>;
  }
  
  // Show loading while checking auth or admin status
  if (isLoading || (requireAdmin && !adminCheckComplete)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">
          {requireAdmin ? 'Checking authorization...' : 'Checking authentication...'}
        </h1>
      </div>
    );
  }
  
  // Handle unauthenticated users
  if (!user && !allowUnauthenticated) {
    logger.log('User not authenticated, redirecting to auth page from:', location.pathname);
    return (
      <Navigate 
        to={`/auth?returnUrl=${encodeURIComponent(location.pathname)}`} 
        replace 
      />
    );
  }
  
  // Handle non-admin users trying to access admin resources
  if (requireAdmin && !isAdmin) {
    logger.log('User is not admin, redirecting to home page');
    toast.error('You do not have access to this resource');
    return <Navigate to="/" replace />;
  }
  
  // If all checks pass, render children
  return <>{children}</>;
};

export default RequireAuth;
