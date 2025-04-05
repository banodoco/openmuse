
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { testSessionRefresh } from '@/lib/auth/currentUser';

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
  const [autoRefreshAttempted, setAutoRefreshAttempted] = useState(false);
  const loadStartTime = React.useRef(Date.now());
  const checkCompleted = React.useRef(false);
  
  // Determine if the path should skip auth checks
  const shouldSkipCheck = 
    allowUnauthenticated || // Always allow if explicitly set
    location.pathname === '/auth' || 
    location.pathname === '/auth/callback' ||
    location.pathname.startsWith('/assets/loras/'); // Allow unauthenticated access to LoRA details

  // Log the state RequireAuth sees *before* any decisions are made
  logger.log(
    `RequireAuth Initial Check (${authCheckCount}) - Path: ${location.pathname}, isAuthLoading: ${isAuthLoading}, User: ${!!user}, Session: ${!!session}, isContextAdmin: ${isContextAdmin}, requireAdmin: ${requireAdmin}, allowUnauthenticated: ${allowUnauthenticated}, shouldSkipCheck: ${shouldSkipCheck}`
  );
  
  useEffect(() => {
    // Only increment check counter if we haven't completed our check yet
    if (!checkCompleted.current) {
      setAuthCheckCount(prev => prev + 1);
    }
    
    // Log authentication status when component mounts or auth state changes
    logger.log(`Auth check #${authCheckCount} - Path: ${location.pathname}, User: ${user ? user.id : 'unauthenticated'}, Session: ${session ? 'valid' : 'none'}, ContextAdmin: ${isContextAdmin ? 'yes' : 'no'}, isLoading: ${isAuthLoading}`);
    
    // If we've been in loading state too long, try auto-refreshing the session once
    const loadingTime = Date.now() - loadStartTime.current;
    if (isAuthLoading && loadingTime > 5000 && !autoRefreshAttempted && !shouldSkipCheck) {
      logger.log(`Auth loading for ${loadingTime}ms - attempting session refresh`);
      setAutoRefreshAttempted(true);
      testSessionRefresh().then(success => {
        logger.log(`Session refresh attempt result: ${success ? 'successful' : 'failed'}`);
      });
    }
    
    // Mark our check as completed if we have auth state
    if (!isAuthLoading && !checkCompleted.current) {
      checkCompleted.current = true;
      logger.log(`Auth check completed after ${authCheckCount} checks and ${Date.now() - loadStartTime.current}ms`);
    }
  }, [user, session, isContextAdmin, isAuthLoading]);

  // Debug check to prevent infinite loading
  useEffect(() => {
    if (isAuthLoading && authCheckCount > 5 && !checkCompleted.current) {
      logger.warn(`Potential loading loop detected in RequireAuth - Path: ${location.pathname}, checks: ${authCheckCount}, time in loading: ${(Date.now() - loadStartTime.current) / 1000}s`);
      
      // After 30 seconds, show a toast with helpful information
      if (authCheckCount === 15) {
        toast.error("Authentication is taking longer than expected. You may need to sign in again.");
      }
      
      // After 20 checks, force completion to break potential loops
      if (authCheckCount > 20 && !checkCompleted.current) {
        logger.error(`Force-breaking potential auth loop after ${authCheckCount} checks`);
        checkCompleted.current = true;
      }
    }
  }, [authCheckCount, isAuthLoading, location.pathname]);
  
  // Use the loading state directly from the Auth context
  const isLoading = isAuthLoading && !checkCompleted.current; 
  
  // Show loading state while authentication is being checked (but not forever)
  if (isLoading) {
    const loadTime = (Date.now() - loadStartTime.current) / 1000;
    logger.log(`Rendering Loading State - Path: ${location.pathname} (Auth Loading: ${isAuthLoading}), check #${authCheckCount}, loading for ${loadTime}s`);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">
          Checking access... {authCheckCount > 5 ? `(${loadTime.toFixed(1)}s)` : ""}
        </h1>
        {authCheckCount > 10 && (
          <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
            {loadTime > 15 ? 
              "This is taking much longer than expected. There may be an issue with the authentication service." :
              "Still checking... This is taking longer than expected."}
          </p>
        )}
        {loadTime > 30 && (
          <div className="mt-4">
            <button 
              onClick={() => window.location.href = '/auth'} 
              className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 transition-colors"
            >
              Go to login page
            </button>
          </div>
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
      `Redirecting to /auth: User not authenticated. Path: ${location.pathname}, User: ${user ? 'exists' : 'null'}, Session: ${session ? 'exists' : 'null'}`
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
  logger.log(`Rendering Children - Path: ${location.pathname}, User authenticated and authorized`);
  return <>{children}</>;
};

export default RequireAuth;
