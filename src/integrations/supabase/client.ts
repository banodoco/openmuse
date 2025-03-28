import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { Logger } from '@/lib/logger';

const logger = new Logger('SupabaseClient');

const SUPABASE_URL = "https://ujlwuvkrxlvoswwkerdf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHd1dmtyeGx2b3N3d2tlcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODM1MDYsImV4cCI6MjA1NzM1OTUwNn0.htwJHr4Z4NlMZYVrH1nNGkU53DyBTWgMeOeUONYFy_4";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? localStorage : undefined,
  }
});

// Log initialization for debugging
logger.log('Supabase client initialized with auth configuration');
logger.log('supabase.ts: Re-exporting the main Supabase client');

// Check if the videos bucket exists but don't try to create it
// This fixes the "maximum allowed size" error
export const checkVideoBucket = async (): Promise<void> => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const videoBucket = buckets?.find(bucket => bucket.name === 'videos');
    
    if (!videoBucket) {
      logger.log('Videos bucket does not exist. Please create it in the Supabase dashboard.');
    } else {
      logger.log('Videos bucket exists');
    }
  } catch (error) {
    logger.error('Error checking if videos bucket exists:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

// Function to check if RLS (Row Level Security) permissions are working
export const testRLSPermissions = async (): Promise<{
  isAuthenticated: boolean;
  assetsAccess: boolean;
  mediaAccess: boolean;
}> => {
  const testId = "test-" + Math.random().toString(36).substring(2, 9);
  logger.log(`Testing RLS permissions... (ID: ${testId})`);
  
  try {
    const { data: session } = await supabase.auth.getSession();
    const isAuthenticated = !!session?.session?.user;
    
    logger.log(`Auth status (${testId}): ${isAuthenticated ? 'Authenticated' : 'Not authenticated'}`);
    
    // Implement the rest of the existing logic with await for each async operation
    const assetsPromise = new Promise<{data: any, error: any}>((resolve) => {
      const timeoutId = setTimeout(() => {
        logger.warn(`Assets query timed out (${testId})`);
        resolve({ data: null, error: { message: "Query timed out" } });
      }, 5000);
      
      supabase
        .from('assets')
        .select('*')
        .limit(1)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          resolve({ data: null, error });
        });
    });
    
    const { data: assets, error: assetsError } = await assetsPromise;
    
    const mediaPromise = new Promise<{data: any, error: any}>((resolve) => {
      const timeoutId = setTimeout(() => {
        logger.warn(`Media query timed out (${testId})`);
        resolve({ data: null, error: { message: "Query timed out" } });
      }, 5000);
      
      supabase
        .from('media')
        .select('*')
        .limit(1)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          resolve({ data: null, error });
        });
    });
    
    const { data: media, error: mediaError } = await mediaPromise;
      
    const assetsAccess = !assetsError;
    const mediaAccess = !mediaError;
    
    if (assetsError) {
      logger.error(`Error testing assets access (${testId}):`, assetsError);
    }
    
    if (mediaError) {
      logger.error(`Error testing media access (${testId}):`, mediaError);
    }
    
    logger.log(`RLS permission test complete (${testId})`);
    
    return {
      isAuthenticated,
      assetsAccess,
      mediaAccess
    };
  } catch (error) {
    logger.error(`Error testing RLS permissions (${testId}):`, error);
    return {
      isAuthenticated: false,
      assetsAccess: false,
      mediaAccess: false
    };
  }
};

// Modify the window-specific initialization to use async/await
if (typeof window !== 'undefined') {
  // Delay the initial checks to ensure auth is initialized first
  setTimeout(async () => {
    try {
      await checkVideoBucket();
    } catch (err) {
      logger.error('Error checking video bucket:', err);
    }
    
    try {
      await testRLSPermissions();
    } catch (err) {
      logger.error('Error testing RLS permissions:', err);
    }
  }, 1000);
}
