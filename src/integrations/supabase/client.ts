import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Test RLS permissions to ensure the user has proper access
export const testRLSPermissions = async () => {
  try {
    // Test media table access
    const mediaPromise = supabase
      .from('media')
      .select('id')
      .limit(1)
      .single();
    
    // Test assets table access
    const assetsPromise = supabase
      .from('assets')
      .select('id')
      .limit(1)
      .single();
    
    // Wait for both checks to complete
    const [mediaResult, assetsResult] = await Promise.all([
      mediaPromise,
      assetsPromise
    ]);
    
    return {
      mediaAccess: !mediaResult.error,
      assetsAccess: !assetsResult.error
    };
  } catch (error) {
    console.error("Error testing RLS permissions:", error);
    return {
      mediaAccess: false,
      assetsAccess: false
    };
  }
};

// Export for convenience
export default supabase;
