import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { testSessionRefresh } from '@/lib/auth/currentUser';

const logger = new Logger('RequireAuth');
logger.log('RequireAuth component mounting');

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
  logger.log(`RequireAuth rendering/initializing. Path: ${location.pathname}, AuthLoading: ${isAuthLoading}`);

  // Determine if the path should skip auth checks
  const shouldSkipCheck =
    allowUnauthenticated || // Always allow if explicitly set
    location.pathname === '/auth' ||
    location.pathname === '/auth/callback' ||
    location.pathname.startsWith('/assets/loras/'); // Allow unauthenticated access to LoRA details

  useEffect(() => {
    logger.log(`[Effect Auth Check] Running effect. Path: ${location.pathname}, AuthLoading: ${isAuthLoading}, checkStarted: ${checkStarted.current}, shouldSkip: ${shouldSkipCheck}`);
    if (checkStarted.current || shouldSkipCheck) {
        logger.log('[Effect Auth Check] Skipping: Check already started or route should be skipped.');
        return;
    }

    // Only start the check once
    checkStarted.current = true;
    logger.log('[Effect Auth Check] Check not started and route not skipped. Starting check logic...');

    // This effect runs when auth state potentially changes or on mount if check hasn't started
    if (!isAuthLoading) {
      logger.log(`[Effect Auth Check] Auth state RESOLVED: User=${!!user}, Session=${!!session}, Admin=${isContextAdmin}`);

      let redirectTarget: string | null = null;

      // Handle unauthenticated users for protected routes
      if (!user || !session) {
        if (!allowUnauthenticated && location.pathname !== '/auth' && location.pathname !== '/auth/callback' && !location.pathname.startsWith('/assets/loras/')) {
          logger.warn(
            `[Effect Auth Check] Decision: REDIRECT to /auth (User not authenticated for protected route). Path: ${location.pathname}`
          );
          redirectTarget = `/auth?returnUrl=${encodeURIComponent(location.pathname)}`;
        } else {
            logger.log('[Effect Auth Check] Decision: ALLOW (User not authenticated, but route allows it or is auth-related).');
        }
      }
      // Handle non-admin users trying to access admin resources
      else if (requireAdmin && !isContextAdmin) {
        logger.warn(
          `[Effect Auth Check] Decision: REDIRECT to / (User is not admin, but admin required). Path: ${location.pathname}`
        );
        toast.error('You do not have access to this resource');
        redirectTarget = "/";
      } else {
          logger.log('[Effect Auth Check] Decision: ALLOW (User authenticated and authorized).');
      }

      setShouldRedirect(redirectTarget);
      setIsCheckComplete(true);
      logger.log(`[Effect Auth Check] Check COMPLETE. Redirect target set to: ${redirectTarget || 'none'}`);
    } else {
      logger.log(`[Effect Auth Check] Auth state PENDING (isAuthLoading is true). Waiting...`);
      // Optionally: Set a timer here to handle excessively long loading times if needed
    }
  // Dependencies: Ensure effect re-runs if auth state changes or location changes (though location change usually remounts)
  }, [isAuthLoading, user, session, isContextAdmin, requireAdmin, allowUnauthenticated, location.pathname, shouldSkipCheck]);

  // --- Render Logic ---
  logger.log(`[Render] Evaluating render logic. isCheckComplete: ${isCheckComplete}, shouldRedirect: ${shouldRedirect}, shouldSkipCheck: ${shouldSkipCheck}`);

  // Apply redirect only *after* the check is complete and a redirect is needed
  if (isCheckComplete && shouldRedirect) {
    logger.log(`[Render] REDIRECTING to ${shouldRedirect}`);
    return <Navigate to={shouldRedirect} replace />;
  }

  // If checks are explicitly skipped, just render children immediately
  if (shouldSkipCheck) {
     logger.log(`[Render] Rendering children (Auth checks skipped for this path: ${location.pathname})`);
     return <>{children}</>;
  }

  // Render children while waiting for auth state OR if access is granted (check complete without redirect)
  if (!isCheckComplete || (isCheckComplete && !shouldRedirect)) {
      logger.log(`[Render] Rendering children (Auth check pending OR completed & access granted). Path: ${location.pathname}`);
      // Optional: Display a non-blocking loading indicator if !isCheckComplete
      // if (!isCheckComplete) { return <> <SubtleLoadingIndicator /> {children} </>; }
      return <>{children}</>;
  }

  // Fallback case (should ideally not be reached with the logic above)
  logger.warn(`[Render] Reached unexpected fallback state. Rendering null. isCheckComplete: ${isCheckComplete}, shouldRedirect: ${shouldRedirect}`);
  return null;
};

export default RequireAuth;
