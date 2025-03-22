
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  
  useEffect(() => {
    let isActive = true; // For cleanup
    
    const handleAuthCallback = async () => {
      try {
        console.log('In AuthCallback, processing...');
        
        // Parse the URL parameters to get the returnUrl if present
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        
        // Check if there's a hash in the URL (from OAuth redirect)
        if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          if (hashParams.get('error')) {
            throw new Error(hashParams.get('error_description') || 'Authentication error');
          }
          
          // If we have an access token in the hash, process it
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('AuthCallback: Found access and refresh tokens');
            // Set the session directly
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              throw error;
            }
            
            if (data.session) {
              console.log('AuthCallback: Session set successfully');
              toast.success('Successfully signed in!');
              
              if (isActive) {
                // Delay redirect slightly to ensure state updates are processed
                setTimeout(() => {
                  if (isActive) {
                    console.log(`AuthCallback: Redirecting to ${returnUrl}`);
                    navigate(returnUrl, { replace: true });
                  }
                }, 800);
              }
              return;
            }
          }
        }
        
        // If no hash or no tokens, check if we're already authenticated
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (data?.session) {
          // Authentication successful
          console.log('AuthCallback: Found existing session');
          toast.success('Successfully signed in!');
          
          if (isActive) {
            // Delay redirect slightly to ensure state updates are processed
            setTimeout(() => {
              if (isActive) {
                console.log(`AuthCallback: Redirecting to ${returnUrl}`);
                navigate(returnUrl, { replace: true });
              }
            }, 800);
          }
        } else {
          // No session found, redirect to auth page with return URL preserved
          console.log('AuthCallback: No session found, redirecting to auth');
          if (isActive) {
            navigate(`/auth?returnUrl=${encodeURIComponent(returnUrl)}`, { replace: true });
          }
        }
      } catch (err: any) {
        console.error('Error during auth callback:', err);
        if (isActive) {
          setError(err.message || 'An error occurred during authentication');
          toast.error(`Authentication error: ${err.message}`);
          
          // Redirect to auth page after a short delay
          setTimeout(() => {
            if (isActive) {
              navigate('/auth', { replace: true });
            }
          }, 3000);
        }
      } finally {
        if (isActive) {
          setIsProcessing(false);
        }
      }
    };
    
    handleAuthCallback();
    
    return () => {
      console.log('AuthCallback: Cleaning up');
      isActive = false;
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
