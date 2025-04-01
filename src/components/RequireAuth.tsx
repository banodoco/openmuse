
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
  
  // Skip checking for certain public pages
  const shouldSkipCheck = 
    location.pathname === '/auth' || 
    location.pathname === '/auth/callback' ||
    location.pathname === '/upload' ||
    location.pathname.startsWith('/assets/loras/');
  
  useEffect(() => {
    // Log authentication status when component mounts or auth state changes
    logger.log(`Auth check - User: ${user ? 'authenticated' : 'unauthenticated'}, Admin: ${isAdmin ? 'yes' : 'no'}`);
  }, [user, isAdmin]);
  
  // Skip checks for certain paths
  if (shouldSkipCheck) {
    logger.log(`Skipping auth check for path: ${location.pathname}`);
    return <>{children}</>;
  }
  
  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">
          {requireAdmin ? 'Checking authorization...' : 'Checking authentication...'}
        </h1>
      </div>
    );
  }
  
  // For the LoRA detail page, allow unauthenticated users
  if (location.pathname.startsWith('/assets/loras/')) {
    return <>{children}</>;
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
