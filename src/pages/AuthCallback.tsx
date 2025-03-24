
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
        
        // Forcing a token exchange here to ensure we get a valid session
        let sessionEstablished = false;
        
        if (window.location.hash || window.location.search.includes('code=')) {
          logger.log('AuthCallback: Detected auth response in URL');
          
          // Let Supabase automatically handle the token exchange
          // Wait a bit to make sure Supabase has time to process the auth response
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Now check if we have a session
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            logger.error('Error getting session after auth response:', sessionError);
            throw sessionError;
          }
          
          if (sessionData?.session) {
            logger.log('AuthCallback: Session established after token exchange', sessionData.session.user.id);
            sessionEstablished = true;
            
            // Force refresh the token
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              logger.error('Error refreshing token:', refreshError);
            } else {
              logger.log('Token refreshed successfully');
            }
            
            if (isActive) {
              toast.success('Successfully signed in!');
              
              // Wait briefly before redirecting to ensure auth state is properly propagated
              timeoutId = setTimeout(() => {
                if (isActive) {
                  logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                  // Use replace: true to avoid browser back button issues
                  navigate(returnUrl, { replace: true });
                }
              }, 1000);
            }
          }
        }
        
        // If we still don't have a session, try one last manual session check
        if (!sessionEstablished) {
          logger.log('AuthCallback: No session established via URL, trying direct session check');
          
          const { data: finalCheck, error: finalError } = await supabase.auth.getSession();
          
          if (finalError) {
            logger.error('Error in final session check:', finalError);
            throw finalError;
          }
          
          if (finalCheck.session) {
            logger.log('AuthCallback: Session found in final check', finalCheck.session.user.id);
            
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
          } else {
            // If we still don't have a session, throw an error
            logger.error('AuthCallback: No session could be established');
            throw new Error('Failed to establish authentication session. Please try again.');
          }
        }
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
