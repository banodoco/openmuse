
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ujlwuvkrxlvoswwkerdf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHd1dmtyeGx2b3N3d2tlcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODM1MDYsImV4cCI6MjA1NzM1OTUwNn0.htwJHr4Z4NlMZYVrH1nNGkU53DyBTWgMeOeUONYFy_4';

// Create a single Supabase client instance for the entire app
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit', // Using implicit flow for more reliable OAuth
    storageKey: 'supabase.auth.token', // Use a consistent storage key
  },
  global: {
    headers: {
      'X-Client-Info': 'videoresponse-webapp',
    },
  },
});

console.log("Supabase client initialized with auth configuration:", {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'implicit'
});

// For backward compatibility
export { supabase as supabaseClient };
