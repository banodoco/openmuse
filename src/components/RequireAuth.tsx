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
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();
  
  // Determine if the path should skip auth checks
  const shouldSkipCheck = 
    allowUnauthenticated || // Always allow if explicitly set
    location.pathname === '/auth' || 
    location.pathname === '/auth/callback' ||
    location.pathname.startsWith('/assets/loras/'); // Allow unauthenticated access to LoRA details

  // Log the state RequireAuth sees *before* any decisions are made
  logger.log(
    `State Check - Path: ${location.pathname}, isLoading: ${isLoading}, User: ${!!user}, isAdmin: ${isAdmin}, requireAdmin: ${requireAdmin}, allowUnauthenticated: ${allowUnauthenticated}, shouldSkipCheck: ${shouldSkipCheck}`
  );
  
  useEffect(() => {
    // Log authentication status when component mounts or auth state changes
    logger.log(`Auth check - User: ${user ? 'authenticated' : 'unauthenticated'}, Admin: ${isAdmin ? 'yes' : 'no'}`);
  }, [user, isAdmin]);
  
  // Show loading state
  if (isLoading) {
    logger.log(`Rendering Loading State - Path: ${location.pathname}`);
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
      `Redirecting to /auth: User not authenticated. Path: ${location.pathname}, isLoading: ${isLoading}`
    );
    return (
      <Navigate 
        to={`/auth?returnUrl=${encodeURIComponent(location.pathname)}`} 
        replace 
      />
    );
  }
  
  // Handle non-admin users trying to access admin resources
  // Only check admin if loading is complete, user exists, and admin is required
  if (!isLoading && user && requireAdmin && !isAdmin) {
    logger.warn(
      `Redirecting to /: User NOT admin. Path: ${location.pathname}, isLoading: ${isLoading}, isAdmin value: ${isAdmin}`
    );
    toast.error('You do not have access to this resource');
    return <Navigate to="/" replace />;
  }
  
  // If all checks pass, render children
  logger.log(`Rendering Children - Path: ${location.pathname}`);
  return <>{children}</>;
};

export default RequireAuth;
