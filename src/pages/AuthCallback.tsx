
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
    
    const handleAuthCallback = async () => {
      try {
        logger.log('AuthCallback: Processing authentication callback');
        
        // Parse the URL parameters to get the returnUrl if present
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        logger.log(`AuthCallback: Return URL is ${returnUrl}`);
        
        // Check if we're already authenticated
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (data?.session) {
          // Authentication successful
          logger.log('AuthCallback: Found session, authentication successful');
          
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
        } else {
          // This is a fallback in case the hash exchange didn't result in a session
          // Exchange the code for a session if there's a code in the URL
          logger.log('AuthCallback: No session found, checking for auth code');
          
          if (window.location.hash || searchParams.get('code')) {
            logger.log('AuthCallback: Hash or code found, trying to exchange for session');
            
            // The hash exchange is handled by Supabase auth internally via the onAuthStateChange event
            // Just wait a bit to see if a session is established
            timeoutId = setTimeout(async () => {
              if (!isActive) return;
              
              // Check again for a session after a short delay
              const { data: sessionData } = await supabase.auth.getSession();
              
              if (sessionData?.session) {
                logger.log('AuthCallback: Session established after hash exchange');
                toast.success('Successfully signed in!');
                navigate(returnUrl, { replace: true });
              } else {
                logger.log('AuthCallback: No session after hash exchange, redirecting to auth');
                toast.error('Authentication failed. Please try again.');
                navigate('/auth', { replace: true });
              }
            }, 2000);
          } else {
            // No hash, no code, and no session - redirect to auth page
            logger.log('AuthCallback: No auth data found, redirecting to auth page');
            
            if (isActive) {
              toast.error('Authentication failed. Please try again.');
              timeoutId = setTimeout(() => {
                if (isActive) {
                  navigate('/auth', { replace: true });
                }
              }, 300);
            }
          }
        }
      } catch (err: any) {
        logger.error('Error during auth callback:', err);
        
        if (isActive) {
          setError(err.message || 'An error occurred during authentication');
          toast.error(`Authentication error: ${err.message}`);
          
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
      }
    };
    
    // Run the auth callback handler
    handleAuthCallback();
    
    return () => {
      logger.log('AuthCallback: Cleaning up');
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
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
