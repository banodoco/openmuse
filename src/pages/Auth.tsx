
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signInWithDiscord, getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { supabase } from '@/lib/supabase';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  
  // Handle authentication from hash fragment (for OAuth redirects)
  useEffect(() => {
    const handleHashRedirect = async () => {
      if (window.location.hash && window.location.hash.includes('access_token')) {
        try {
          console.log('Processing auth hash...');
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              throw error;
            }
            
            if (data.session) {
              let returnUrl = '/';
              
              const actualOrigin = localStorage.getItem('actual_auth_origin');
              if (actualOrigin) {
                localStorage.removeItem('actual_auth_origin');
                
                const searchParams = new URLSearchParams(location.search);
                const queryReturnUrl = searchParams.get('returnUrl');
                
                if (queryReturnUrl) {
                  returnUrl = queryReturnUrl;
                }
                
                toast.success('Successfully signed in with Discord!');
                
                window.location.href = `${actualOrigin}${returnUrl}`;
                return;
              } else {
                const searchParams = new URLSearchParams(location.search);
                returnUrl = searchParams.get('returnUrl') || '/';
                
                toast.success('Successfully signed in with Discord!');
                navigate(returnUrl);
                return;
              }
            }
          }
        } catch (error: any) {
          console.error('Error processing auth hash:', error);
          toast.error(`Authentication error: ${error.message}`);
        }
      }
    };
    
    handleHashRedirect();
  }, [navigate, location]);
  
  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        navigate(returnUrl);
      }
    };
    
    checkSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        navigate(returnUrl);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, location]);
  
  const handleDiscordSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithDiscord();
    } catch (error) {
      console.error('Error signing in with Discord:', error);
      toast.error('Failed to sign in with Discord');
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-subtle space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Sign In</h1>
            <p className="text-muted-foreground">
              Sign in to VideoResponse to upload and react to videos
            </p>
          </div>
          
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={handleDiscordSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
            ) : (
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 127.14 96.36"
                fill="currentColor"
              >
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
            )}
            Sign in with Discord
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Auth;
