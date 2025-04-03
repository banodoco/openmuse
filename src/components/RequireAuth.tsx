import React, { useEffect } from 'react';
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
  const { user, isLoading: isAuthLoading, isAdmin: isContextAdmin } = useAuth();
  const location = useLocation();
  
  // Determine if the path should skip auth checks
  const shouldSkipCheck = 
    allowUnauthenticated || // Always allow if explicitly set
    location.pathname === '/auth' || 
    location.pathname === '/auth/callback' ||
    location.pathname.startsWith('/assets/loras/'); // Allow unauthenticated access to LoRA details

  // Log the state RequireAuth sees *before* any decisions are made
  logger.log(
    `State Check - Path: ${location.pathname}, isAuthLoading: ${isAuthLoading}, User: ${!!user}, isContextAdmin: ${isContextAdmin}, requireAdmin: ${requireAdmin}, allowUnauthenticated: ${allowUnauthenticated}, shouldSkipCheck: ${shouldSkipCheck}`
  );
  
  useEffect(() => {
    // Log authentication status when component mounts or auth state changes
    logger.log(`Auth check - User: ${user ? 'authenticated' : 'unauthenticated'}, ContextAdmin: ${isContextAdmin ? 'yes' : 'no'}`);
  }, [user, isContextAdmin]);

  // Use the loading state directly from the Auth context.
  // AuthProvider now correctly handles loading until admin status is confirmed.
  const isLoading = isAuthLoading; 
  
  // Show loading state
  // Add log before the loading check
  logger.log(`RequireAuth Checkpoint 1: Before isLoading check. isAuthLoading=${isAuthLoading}, isContextAdmin=${isContextAdmin}`);
  if (isLoading) {
    // Updated log message
    logger.log(`Rendering Loading State - Path: ${location.pathname} (Auth Loading: ${isAuthLoading})`);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">
          {/* Simplified message as AuthProvider handles context */}
          Checking access... 
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
  // Use isContextAdmin directly now.
  // Add log before the admin check
  logger.log(`RequireAuth Checkpoint 2: Before requireAdmin check. isAuthLoading=${isAuthLoading}, isContextAdmin=${isContextAdmin}, requireAdmin=${requireAdmin}`);
  if (requireAdmin && !isContextAdmin) {
    // Updated log message
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
