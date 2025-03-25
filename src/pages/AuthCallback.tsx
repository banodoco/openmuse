
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
        // Parse the URL parameters to get the returnUrl if present
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        
        logger.log('AuthCallback: Processing callback', { 
          hash: !!window.location.hash,
          hashLength: window.location.hash.length,
          query: window.location.search,
          returnUrl
        });

        // Let Supabase handle the OAuth callback
        // The supabase.auth.getSession() call below will trigger the internal processing
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
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            logger.error('Error refreshing session:', refreshError);
          } else if (refreshData.session) {
            logger.log('Session refreshed successfully', {
              userId: refreshData.session.user.id,
              expiresAt: refreshData.session.expires_at
            });
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
          // If we don't have a session, try to detect the hash in URL
          logger.log('No session found after initial check, checking for hash/code in URL');
          
          if (window.location.hash || window.location.search.includes('code=')) {
            logger.log('Found hash or code in URL, waiting for Supabase to process it');
            
            // Wait a bit to allow Supabase to process the token
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check again for a session
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
              logger.error('Error in second session check:', sessionError);
              throw sessionError;
            }
            
            if (sessionData.session) {
              logger.log('Session established in second check', {
                userId: sessionData.session.user.id
              });
              
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
              logger.error('No session established after OAuth callback');
              throw new Error('Failed to establish authentication session. Please try again.');
            }
          } else {
            logger.error('No hash or code found in URL, and no session established');
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
