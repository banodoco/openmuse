import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { mergeProfileIfExists } from '../lib/auth/userProfile';

const logger = new Logger('AuthCallback');

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  
  useEffect(() => {
    let isActive = true;
    
    // logger.log('AuthCallback: Mounted. Waiting for AuthProvider to handle session...', {
    //   hash: !!window.location.hash,
    //   query: window.location.search,
    // });
    
    // Set a timeout only as a fallback for catastrophic failure
    const maxWaitTimeoutId = setTimeout(() => {
      if (isActive && isProcessing && !user) {
        logger.error('Auth callback timed out after 15 seconds - no session detected by AuthProvider');
        setError('Authentication timed out or failed. Please try signing in again.');
        setIsProcessing(false);
      }
    }, 15000); 
    
    return () => {
      // logger.log('AuthCallback: Cleaning up');
      isActive = false;
      clearTimeout(maxWaitTimeoutId);
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isProcessing) return;
    
    if (user) {
      const searchParams = new URLSearchParams(location.search);
      const returnUrl = searchParams.get('returnUrl') || '/';
      
      // logger.log(`AuthCallback: User detected by AuthProvider, navigating to ${returnUrl}`);
      
      // Manually clear the hash to prevent Supabase client from re-reading it
      // logger.log('AuthCallback: Clearing window.location.hash');
      window.location.hash = '';
      
      // Attempt to merge an unclaimed profile if it exists using Discord identifiers
      const userMetadata = user.user_metadata;
      const discordUsername = userMetadata?.user_name || userMetadata?.discord_username; // Check common keys
      const discordUserId = userMetadata?.provider_id || userMetadata?.discord_user_id; // Check common keys for Discord ID

      if (discordUsername || discordUserId) {
        logger.log('Attempting merge with identifiers:', { discordUsername, discordUserId });
        // Pass both identifiers to the merge function
        mergeProfileIfExists(supabase, user.id, { discordUsername, discordUserId });
      } else {
        logger.log('No Discord identifiers found in user metadata for potential merge.');
      }
      
      queueMicrotask(() => {
         navigate(returnUrl, { replace: true });
      });
    } else {
      // logger.log('AuthCallback: AuthProvider finished loading, but no user session found.');
      if (isProcessing) {
           setIsProcessing(false);
      }
    }
  }, [user, isAuthLoading, navigate, location.search, isProcessing]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {error ? (
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Authentication Issue</h1>
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={() => navigate('/auth', { replace: true })}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Go to Sign In
          </button>
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
