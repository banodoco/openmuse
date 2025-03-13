
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser, checkIsAdmin } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

interface RequireAuthProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        
        if (!user) {
          setIsAuthorized(false);
          return;
        }
        
        if (requireAdmin) {
          const isAdmin = await checkIsAdmin(user.id);
          setIsAuthorized(isAdmin);
        } else {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error('Error checking authorization:', error);
        setIsAuthorized(false);
      }
    };
    
    checkAuth();
  }, [requireAdmin]);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-medium mt-4">Checking authorization...</h1>
      </div>
    );
  }

  if (isAuthorized === false) {
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
