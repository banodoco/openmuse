
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
        logger.error('Auth callback timed out after 15 seconds');
        setError('Authentication timed out. Please try again.');
        toast.error('Authentication timed out. Please try again.');
        navigate('/auth', { replace: true });
      }
    }, 15000); // 15 second timeout
    
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
        
        // Clear any previous auth tokens to ensure clean state
        if (typeof window !== 'undefined') {
          // Remove any old tokens that might be causing conflicts
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
              keysToRemove.push(key);
            }
          }
          
          for (const key of keysToRemove) {
            localStorage.removeItem(key);
          }
        }
        
        // Check if we have a hash or code in the URL which indicates an OAuth response
        if (window.location.hash || searchParams.get('code')) {
          logger.log('AuthCallback: Found auth data, processing OAuth response');
          
          // Wait for the auth library to process the URL parameters
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Use the exchange code flow for PKCE
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            searchParams.get('code') || window.location.hash
          );
          
          if (error) {
            logger.error('Error exchanging code for session:', error);
            throw error;
          }
          
          if (data?.session) {
            logger.log('AuthCallback: Session established via code exchange');
            
            // Ensure the session is stored properly
            await supabase.auth.setSession(data.session);
            
            if (isActive) {
              toast.success('Successfully signed in!');
              
              // Add a delay before redirecting to ensure state updates are processed
              timeoutId = setTimeout(() => {
                if (isActive) {
                  logger.log(`AuthCallback: Redirecting to ${returnUrl}`);
                  navigate(returnUrl, { replace: true });
                }
              }, 1000);
            }
            return;
          }
        }
        
        // If we get here, try to get the session directly (fallback)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          logger.error('Error getting session:', sessionError);
          throw sessionError;
        }
        
        if (sessionData?.session) {
          logger.log('AuthCallback: Session found directly in getSession');
          
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
        
        // No session found through either method - likely an error
        logger.error('AuthCallback: No session could be established');
        throw new Error('Failed to establish session after authentication callback');
        
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
