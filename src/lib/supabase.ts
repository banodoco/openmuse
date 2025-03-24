
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ujlwuvkrxlvoswwkerdf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHd1dmtyeGx2b3N3d2tlcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODM1MDYsImV4cCI6MjA1NzM1OTUwNn0.htwJHr4Z4NlMZYVrH1nNGkU53DyBTWgMeOeUONYFy_4';

// Create a single Supabase client instance with improved logging
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Enable automatic hash detection
    flowType: 'implicit', // Use implicit flow for OAuth
    debug: true // Enable auth debugging
  }
});

console.log("Supabase client initialized");

// Export the client for backward compatibility
export { supabase as supabaseClient };
