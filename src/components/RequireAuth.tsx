import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { checkIsAdmin } from '@/lib/auth/userRoles';

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
  const { user, isLoading: isAuthLoading, isAdmin: isAdminFromContext } = useAuth();
  const location = useLocation();
  
  // Local state for admin check result
  const [localIsAdmin, setLocalIsAdmin] = useState<boolean | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);

  // Determine if the path should skip auth checks
  const shouldSkipCheck = 
    allowUnauthenticated || // Always allow if explicitly set
    location.pathname === '/auth' || 
    location.pathname === '/auth/callback' ||
    location.pathname.startsWith('/assets/loras/'); // Allow unauthenticated access to LoRA details

  // Log the state RequireAuth sees *before* any decisions are made
  logger.log(
    `State Check - Path: ${location.pathname}, isAuthLoading: ${isAuthLoading}, User: ${!!user}, isAdminFromContext: ${isAdminFromContext}, requireAdmin: ${requireAdmin}, allowUnauthenticated: ${allowUnauthenticated}, shouldSkipCheck: ${shouldSkipCheck}, localIsAdmin: ${localIsAdmin}`
  );
  
  useEffect(() => {
    // Log authentication status when component mounts or auth state changes
    logger.log(`Auth check - User: ${user ? 'authenticated' : 'unauthenticated'}, AdminFromContext: ${isAdminFromContext ? 'yes' : 'no'}`);
  }, [user, isAdminFromContext]);

  // Effect to perform local admin check when auth is loaded and admin is required
  useEffect(() => {
    let isActive = true;
    if (!isAuthLoading && user && requireAdmin && localIsAdmin === null) {
      setIsCheckingAdmin(true);
      logger.log(`Performing local admin check for user: ${user.id}`);
      checkIsAdmin(user.id).then(result => {
        if (isActive) {
          logger.log(`Local admin check result: ${result}`);
          setLocalIsAdmin(result);
          setIsCheckingAdmin(false);
        }
      }).catch(err => {
        logger.error('Local admin check failed:', err);
        if (isActive) {
          setLocalIsAdmin(false); // Default to false on error
          setIsCheckingAdmin(false);
        }
      });
    }
     // Reset local check if user logs out or auth becomes loading again
     else if (isAuthLoading || !user) {
        setLocalIsAdmin(null);
     }
    
    return () => { isActive = false; };
  }, [isAuthLoading, user, requireAdmin, localIsAdmin]);

  // Combined Loading State: Auth loading OR local admin check in progress (if required)
  const isLoading = isAuthLoading || (requireAdmin && isCheckingAdmin);
  
  // Show loading state
  if (isLoading) {
    logger.log(`Rendering Loading State - Path: ${location.pathname} (Auth: ${isAuthLoading}, AdminCheck: ${isCheckingAdmin})`);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">
          {requireAdmin ? 'Checking authorization...' : 'Checking authentication...'}
        </h1>
      </div>
    );
  }
  
  // Handle skipped checks first
  if (shouldSkipCheck) {
    logger.log(`Skipping Auth Checks - Path: ${location.pathname}`);
    return <>{children}</>;
  }
  
  // Handle unauthenticated users for protected routes
  if (!user) {
    logger.warn(
      `Redirecting to /auth: User not authenticated. Path: ${location.pathname}, isAuthLoading: ${isAuthLoading}`
    );
    return (
      <Navigate 
        to={`/auth?returnUrl=${encodeURIComponent(location.pathname)}`} 
        replace 
      />
    );
  }
  
  // Handle non-admin users trying to access admin resources
  // Use localIsAdmin status if requireAdmin is true, otherwise ignore
  if (requireAdmin && localIsAdmin === false) {
    logger.warn(
      `Redirecting to /: User NOT admin (local check). Path: ${location.pathname}, isAdminFromContext: ${isAdminFromContext}, localIsAdmin: ${localIsAdmin}`
    );
    toast.error('You do not have access to this resource');
    return <Navigate to="/" replace />;
  }
  
  // If all checks pass, render children
  logger.log(`Rendering Children - Path: ${location.pathname}`);
  return <>{children}</>;
};

export default RequireAuth;
