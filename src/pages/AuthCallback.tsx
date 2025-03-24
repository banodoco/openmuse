
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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
    let isActive = true; // For cleanup
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Set a timeout to avoid infinite loading state
    const maxWaitTimeoutId = setTimeout(() => {
      if (isActive && isProcessing) {
        logger.error('Auth callback timed out after 10 seconds');
        setError('Authentication timed out. Please try again.');
        toast.error('Authentication timed out. Please try again.');
        navigate('/auth', { replace: true });
      }
    }, 10000); // 10 seconds max wait
    
    const handleAuthCallback = async () => {
      try {
        logger.log('AuthCallback: Processing authentication callback', { 
          hash: !!window.location.hash,
          hashLength: window.location.hash.length,
          query: window.location.search
        });
        
        // Parse the URL parameters to get the returnUrl if present
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        logger.log(`AuthCallback: Return URL is ${returnUrl}`);
        
        // Check if we have a hash in the URL which indicates an OAuth response
        if (window.location.hash) {
          logger.log('AuthCallback: Found hash, processing OAuth response');
          
          // The hash exchange is handled by Supabase auth automatically
          // Use getSession directly to check if it worked
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            throw sessionError;
          }
          
          if (sessionData?.session) {
            logger.log('AuthCallback: Session established after hash exchange');
            if (isActive) {
              toast.success('Successfully signed in!');
              // Add a slight delay before redirecting to ensure state updates are processed
              timeoutId = setTimeout(() => {
                if (isActive) {
                  logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                  navigate(returnUrl, { replace: true });
                }
              }, 500);
            }
            return;
          } else {
            // If no session established yet, try once more after a short delay
            logger.log('AuthCallback: No session yet after hash, waiting briefly and trying again');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const { data: retrySessionData, error: retryError } = await supabase.auth.getSession();
            
            if (retryError) {
              throw retryError;
            }
            
            if (retrySessionData?.session) {
              logger.log('AuthCallback: Session established on retry');
              if (isActive) {
                toast.success('Successfully signed in!');
                timeoutId = setTimeout(() => {
                  if (isActive) {
                    logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                    navigate(returnUrl, { replace: true });
                  }
                }, 500);
              }
              return;
            } else {
              logger.error('AuthCallback: Still no session after retry');
              throw new Error('Failed to establish session after OAuth callback');
            }
          }
        } else if (searchParams.get('code')) {
          // Handle the code-based flow if needed
          logger.log('AuthCallback: Code flow detected, waiting for session establishment');
          
          // Wait a moment for the session to be established
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            throw sessionError;
          }
          
          if (sessionData?.session) {
            logger.log('AuthCallback: Session established with code flow');
            if (isActive) {
              toast.success('Successfully signed in!');
              timeoutId = setTimeout(() => {
                if (isActive) {
                  logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                  navigate(returnUrl, { replace: true });
                }
              }, 500);
            }
          } else {
            logger.error('AuthCallback: No session established with code flow');
            throw new Error('Failed to establish session with code flow');
          }
        } else {
          // No hash, no code, and no session - redirect to auth page
          logger.error('AuthCallback: No auth data found in URL');
          throw new Error('No authentication data found in the callback URL');
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
          }, 1000);
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
