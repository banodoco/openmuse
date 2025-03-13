
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signInWithDiscord, getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';
import { Discord } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { supabase } from '@/lib/supabase';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Get the return URL from the query string or default to '/'
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        navigate(returnUrl);
      }
    };
    
    checkSession();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Get the return URL from the query string or default to '/'
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || '/';
        navigate(returnUrl);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, location]);
  
  // Check if this is a callback from OAuth provider
  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      // This is a callback from OAuth provider, get the fragment
      const params = new URLSearchParams(window.location.hash.substring(1));
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      
      if (error) {
        toast.error(`Authentication error: ${errorDescription || error}`);
      } else {
        toast.success('Successfully signed in with Discord!');
      }
    }
  }, []);
  
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
              <Discord className="h-5 w-5" />
            )}
            Sign in with Discord
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Auth;
