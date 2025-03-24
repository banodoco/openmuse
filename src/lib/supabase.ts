
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ujlwuvkrxlvoswwkerdf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHd1dmtyeGx2b3N3d2tlcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODM1MDYsImV4cCI6MjA1NzM1OTUwNn0.htwJHr4Z4NlMZYVrH1nNGkU53DyBTWgMeOeUONYFy_4';

// Create a single Supabase client instance for the entire app
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Explicitly use localStorage for storage
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    // Use a consistent storage key that doesn't conflict with other apps
    storageKey: 'sb:token',
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
  storageKey: 'sb:token'
});

// For backward compatibility
export { supabase as supabaseClient };
