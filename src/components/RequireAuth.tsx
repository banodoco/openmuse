import React, { useEffect, useState, useRef } from 'react';
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
  const [shouldRedirect, setShouldRedirect] = useState<string | null>(null);
  const [isCheckComplete, setIsCheckComplete] = useState(false);
  const checkStarted = useRef(false);

  // Determine if the path should skip auth checks
  const shouldSkipCheck =
    allowUnauthenticated || // Always allow if explicitly set
    location.pathname === '/auth' ||
    location.pathname === '/auth/callback' ||
    location.pathname.startsWith('/assets/loras/'); // Allow unauthenticated access to LoRA details

  useEffect(() => {
    if (checkStarted.current || shouldSkipCheck) return;
    checkStarted.current = true;
    
    logger.log(
      `RequireAuth Check START - Path: ${location.pathname}, isAuthLoading: ${isAuthLoading}, requireAdmin: ${requireAdmin}, allowUnauthenticated: ${allowUnauthenticated}`
    );

    // This effect runs when auth state potentially changes
    if (!isAuthLoading) {
      logger.log(`Auth state resolved: User=${!!user}, Session=${!!session}, Admin=${isContextAdmin}`);
      
      let redirectTarget: string | null = null;

      // Handle unauthenticated users for protected routes
      if (!user || !session) {
        if (!allowUnauthenticated && location.pathname !== '/auth' && location.pathname !== '/auth/callback') {
          logger.warn(
            `Redirecting to /auth: User not authenticated for protected route. Path: ${location.pathname}`
          );
          redirectTarget = `/auth?returnUrl=${encodeURIComponent(location.pathname)}`;
        }
      }
      // Handle non-admin users trying to access admin resources
      else if (requireAdmin && !isContextAdmin) {
        logger.warn(
          `Redirecting to /: User NOT admin (checked context). Path: ${location.pathname}`
        );
        toast.error('You do not have access to this resource');
        redirectTarget = "/";
      }

      setShouldRedirect(redirectTarget);
      setIsCheckComplete(true);
      logger.log(`RequireAuth Check COMPLETE - Path: ${location.pathname}, Redirect target: ${redirectTarget || 'none'}`);
    } else {
      logger.log(`RequireAuth waiting for auth state - Path: ${location.pathname}`);
      // Optionally: Set a timer here to handle excessively long loading times if needed
    }
  }, [isAuthLoading, user, session, isContextAdmin, requireAdmin, allowUnauthenticated, location.pathname, shouldSkipCheck]);

  // Render children immediately
  // Apply redirect only *after* the check is complete and a redirect is needed
  if (isCheckComplete && shouldRedirect) {
    return <Navigate to={shouldRedirect} replace />;
  }

  // If checks are skipped, just render children
  if (shouldSkipCheck) {
     logger.log(`Skipping Auth Checks - Path: ${location.pathname}`);
     return <>{children}</>;
  }

  // Render children while waiting for auth state or if access is granted
  // Consider adding a subtle, non-blocking loading indicator here if desired
  // e.g., a small spinner in a corner or a top progress bar
  // For now, just render children directly.
  logger.log(`Rendering Children (check complete: ${isCheckComplete}, redirect: ${shouldRedirect}) - Path: ${location.pathname}`);
  return <>{children}</>;
};

export default RequireAuth;
