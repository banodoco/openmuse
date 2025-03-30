
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
        navigate('/auth', { replace: true });
      }
    }, 15000);
    
    const handleAuthCallback = async () => {
      try {
        // Parse the URL parameters to get the returnUrl if present
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        
        logger.log('AuthCallback: Processing callback', { 
          hash: !!window.location.hash,
          hashLength: window.location.hash.length,
          query: window.location.search,
          returnUrl
        });

        // First let Supabase handle any OAuth redirect
        if (location.hash || location.search.includes('code=')) {
          logger.log('Auth callback: Hash or code detected in URL, setting session');
          
          // Supabase will automatically handle session establishment - wait briefly
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Now get the session to confirm authentication worked
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error getting session during callback:', error);
          throw error;
        }
        
        if (data?.session) {
          logger.log('AuthCallback: Session established after callback', {
            userId: data.session.user.id,
            expiresAt: data.session.expires_at
          });

          // Force refresh the session to ensure we have the latest tokens
          try {
            await supabase.auth.refreshSession();
            logger.log('Session refreshed successfully');
          } catch (refreshError) {
            // Non-fatal, log but continue
            logger.error('Error refreshing session:', refreshError);
          }
          
          if (isActive) {
            toast.success('Successfully signed in!');
            
            // Wait briefly before redirecting to ensure auth state is properly propagated
            timeoutId = setTimeout(() => {
              if (isActive) {
                logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                navigate(returnUrl, { replace: true });
              }
            }, 1000);
          }
        } else {
          // If we don't have a session but see auth parameters, try again
          if (location.hash || location.search.includes('code=')) {
            logger.log('No session yet but found auth params, waiting and retrying');
            
            // Wait a bit longer to allow Supabase to process the token
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try once more
            const { data: sessionData } = await supabase.auth.getSession();
            
            if (sessionData?.session) {
              logger.log('Session established on second attempt');
              
              if (isActive) {
                toast.success('Successfully signed in!');
                
                timeoutId = setTimeout(() => {
                  if (isActive) {
                    logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                    navigate(returnUrl, { replace: true });
                  }
                }, 1000);
              }
            } else {
              // Still no session, something's wrong
              throw new Error('Failed to establish authentication session. Please try again.');
            }
          } else {
            logger.error('No auth parameters found in URL');
            throw new Error('Invalid authentication response. Please try again.');
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
