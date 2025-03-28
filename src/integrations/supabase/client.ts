
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { toast } from 'sonner';

// Initialize Supabase client with fallback values for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ujlwuvkrxlvoswwkerdf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHd1dmtyeGx2b3N3d2tlcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODM1MDYsImV4cCI6MjA1NzM1OTUwNn0.htwJHr4Z4NlMZYVrH1nNGkU53DyBTWgMeOeUONYFy_4';

// Initialize the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Log initialization
console.log(`[SupabaseClient] Initialized with URL: ${supabaseUrl.substring(0, 20)}...`);

// Check if videos bucket exists
const checkBuckets = async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const videosBucket = buckets?.find(bucket => bucket.name === 'videos');
    
    if (!videosBucket) {
      console.info('[SupabaseClient] Videos bucket does not exist. Please create it in the Supabase dashboard.');
    }
    
    console.info('[SupabaseClient] Video bucket check complete');
  } catch (error) {
    console.error('[SupabaseClient] Error checking buckets:', error);
  }
};

// Initialize on load
checkBuckets();

// Test RLS permissions to ensure the user has proper access
export const testRLSPermissions = async () => {
  const testId = `test-${Math.random().toString(36).substring(2, 10)}`;
  console.info(`[SupabaseClient] Testing RLS permissions... (ID: ${testId})`);
  
  // Check auth status
  const { data: { session } } = await supabase.auth.getSession();
  console.info(`[SupabaseClient] Auth status (${testId}): ${session?.user ? 'Authenticated' : 'Not authenticated'}`);
  
  try {
    // Test media table access - Fix the query to avoid 406 errors by using count instead of select id
    let mediaAccess = false;
    try {
      const { count, error: mediaError } = await supabase
        .from('media')
        .select('*', { count: 'exact', head: true });
      
      mediaAccess = !mediaError;
    } catch (err) {
      console.error("[SupabaseClient] Error testing media access:", err);
      mediaAccess = false;
    }
    
    // Test assets table access - Fix the query to avoid 406 errors by using count instead of select id
    let assetsAccess = false;
    try {
      const { count, error: assetsError } = await supabase
        .from('assets')
        .select('*', { count: 'exact', head: true });
      
      assetsAccess = !assetsError;
    } catch (err) {
      console.error("[SupabaseClient] Error testing assets access:", err);
      assetsAccess = false;
    }
    
    console.info(`[SupabaseClient] RLS permission test complete (${testId})`);
    
    return {
      mediaAccess,
      assetsAccess
    };
  } catch (error) {
    console.error("[SupabaseClient] Error testing RLS permissions:", error);
    return {
      mediaAccess: false,
      assetsAccess: false
    };
  } finally {
    console.info('[SupabaseClient] RLS permissions test complete');
  }
};

// Export for convenience
export default supabase;
