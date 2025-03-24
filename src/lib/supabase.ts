
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
    flowType: 'pkce', // Use PKCE flow for better security
    storageKey: 'supabase_auth_token', // Keep consistent storage key
    debug: process.env.NODE_ENV === 'development', // Only debug in development
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
  flowType: 'pkce'
});

// For backward compatibility
export { supabase as supabaseClient };
