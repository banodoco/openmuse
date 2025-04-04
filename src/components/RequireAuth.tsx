
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

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
  const { user, session, isLoading: isAuthLoading, isAdmin: isContextAdmin } = useAuth();
  const location = useLocation();
  const [authCheckCount, setAuthCheckCount] = useState(0);
  
  // Determine if the path should skip auth checks
  const shouldSkipCheck = 
    allowUnauthenticated || // Always allow if explicitly set
    location.pathname === '/auth' || 
    location.pathname === '/auth/callback' ||
    location.pathname.startsWith('/assets/loras/'); // Allow unauthenticated access to LoRA details

  // Log the state RequireAuth sees *before* any decisions are made
  logger.log(
    `State Check (${authCheckCount}) - Path: ${location.pathname}, isAuthLoading: ${isAuthLoading}, User: ${!!user}, Session: ${!!session}, isContextAdmin: ${isContextAdmin}, requireAdmin: ${requireAdmin}, allowUnauthenticated: ${allowUnauthenticated}, shouldSkipCheck: ${shouldSkipCheck}`
  );
  
  useEffect(() => {
    // Increment the check counter for logging purposes
    setAuthCheckCount(prev => prev + 1);
    // Log authentication status when component mounts or auth state changes
    logger.log(`Auth check #${authCheckCount} - Path: ${location.pathname}, User: ${user ? 'authenticated' : 'unauthenticated'}, ContextAdmin: ${isContextAdmin ? 'yes' : 'no'}, isLoading: ${isAuthLoading}`);
  }, [user, isContextAdmin, isAuthLoading]);

  // Debug check to prevent infinite loading
  useEffect(() => {
    if (isAuthLoading && authCheckCount > 5) {
      logger.warn(`Potential loading loop detected in RequireAuth - Path: ${location.pathname}, checks: ${authCheckCount}`);
    }
  }, [authCheckCount, isAuthLoading, location.pathname]);
  
  // Use the loading state directly from the Auth context
  const isLoading = isAuthLoading; 
  
  // Show loading state while authentication is being checked
  if (isLoading) {
    logger.log(`Rendering Loading State - Path: ${location.pathname} (Auth Loading: ${isAuthLoading}), check #${authCheckCount}`);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">
          Checking access... {authCheckCount > 5 ? "(slow authentication)" : ""}
        </h1>
        {authCheckCount > 10 && (
          <p className="text-sm text-muted-foreground mt-2">
            Still checking... This is taking longer than expected.
          </p>
        )}
      </div>
    );
  }
  
  // Handle skipped checks first
  if (shouldSkipCheck) {
    logger.log(`Skipping Auth Checks - Path: ${location.pathname}`);
    return <>{children}</>;
  }
  
  // Handle unauthenticated users for protected routes
  if (!user || !session) {
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
  if (requireAdmin && !isContextAdmin) {
    logger.warn(
      `Redirecting to /: User NOT admin (checked context). Path: ${location.pathname}, isContextAdmin: ${isContextAdmin}`
    );
    toast.error('You do not have access to this resource');
    return <Navigate to="/" replace />;
  }
  
  // If all checks pass, render children
  logger.log(`Rendering Children - Path: ${location.pathname}`);
  return <>{children}</>;
};

export default RequireAuth;
