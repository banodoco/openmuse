
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';

const logger = new Logger('AuthCallback');

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  
  useEffect(() => {
    let isActive = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Set a timeout to avoid infinite loading state
    const maxWaitTimeoutId = setTimeout(() => {
      if (isActive && isProcessing) {
        logger.error('Auth callback timed out after 15 seconds');
        setError('Authentication timed out. Please try again.');
        toast.error('Authentication timed out. Please try again.');
        navigate('/auth', { replace: true });
      }
    }, 15000);
    
    const handleAuthCallback = async () => {
      try {
        logger.log('AuthCallback: Processing callback', { 
          hash: !!window.location.hash,
          hashLength: window.location.hash.length,
          query: window.location.search
        });
        
        // Parse the URL parameters to get the returnUrl if present
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        logger.log(`AuthCallback: Return URL is ${returnUrl}`);
        
        // First try getting the session directly
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          logger.error('Error getting session:', sessionError);
          throw sessionError;
        }
        
        if (sessionData?.session) {
          logger.log('AuthCallback: Session found directly');
          
          if (isActive) {
            toast.success('Successfully signed in!');
            // Wait briefly before redirecting
            timeoutId = setTimeout(() => {
              if (isActive) {
                logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                navigate(returnUrl, { replace: true });
              }
            }, 1000);
          }
          return;
        }
        
        // If we don't have a session, try to exchange the auth code
        if (window.location.hash || window.location.search.includes('code=')) {
          logger.log('AuthCallback: Attempting to exchange auth code');
          
          try {
            // Explicitly get the URL hash and parameters
            const hash = window.location.hash.substring(1);
            const query = window.location.search.substring(1);
            const fullParams = hash || query;
            
            if (fullParams.includes('error=')) {
              const errorParams = new URLSearchParams(fullParams);
              const errorDescription = errorParams.get('error_description');
              throw new Error(errorDescription || 'Authentication error');
            }
            
            // Manually check for session after hash-based signin
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Refresh the session
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              logger.error('Error refreshing session:', refreshError);
              throw refreshError;
            }
            
            if (refreshData.session) {
              logger.log('AuthCallback: Session established after refresh');
              
              if (isActive) {
                toast.success('Successfully signed in!');
                
                timeoutId = setTimeout(() => {
                  if (isActive) {
                    logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                    navigate(returnUrl, { replace: true });
                  }
                }, 1000);
              }
              return;
            }
            
            // Final fallback for session
            const { data: finalCheck } = await supabase.auth.getSession();
            if (finalCheck.session) {
              logger.log('AuthCallback: Session found in final check');
              if (isActive) {
                toast.success('Successfully signed in!');
                navigate(returnUrl, { replace: true });
              }
              return;
            }
          } catch (error) {
            logger.error('Error exchanging auth code:', error);
            throw error;
          }
        }
        
        // If we still don't have a session, throw an error
        logger.error('AuthCallback: No session could be established');
        throw new Error('Failed to establish authentication session. Please try again.');
      } catch (err: any) {
        logger.error('Error during auth callback:', err);
        
        if (isActive) {
          setError(err.message || 'An error occurred during authentication');
          toast.error(`Authentication error: ${err.message || 'Failed to sign in'}`);
          
          // Redirect to auth page after a short delay
          timeoutId = setTimeout(() => {
            if (isActive) {
              navigate('/auth', { replace: true });
            }
          }, 1500);
        }
      } finally {
        if (isActive) {
          setIsProcessing(false);
        }
        
        if (maxWaitTimeoutId) {
          clearTimeout(maxWaitTimeoutId);
        }
      }
    };
    
    // Run the auth callback handler
    handleAuthCallback();
    
    return () => {
      logger.log('AuthCallback: Cleaning up');
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (maxWaitTimeoutId) clearTimeout(maxWaitTimeoutId);
    };
  }, [navigate, location.search]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {error ? (
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <p>Redirecting to login page...</p>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Finalizing Authentication</h1>
          <p className="text-muted-foreground">Please wait while we complete the sign-in process...</p>
        </div>
      )}
    </div>
  );
};

export default AuthCallback;
