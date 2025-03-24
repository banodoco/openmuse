
// This file is now a simple re-export of the main Supabase client
// to maintain backward compatibility with existing imports
import { supabase } from '@/integrations/supabase/client';

console.log("Supabase client initialized with auth configuration:", {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  storageKey: 'supabase-auth-token'
});

// For backward compatibility
export { supabase as supabaseClient };
export { supabase };
