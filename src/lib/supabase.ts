
// This file is now a simple re-export of the main Supabase client
// to maintain backward compatibility with existing imports
import { supabase } from '@/integrations/supabase/client';

console.log("supabase.ts: Re-exporting the main Supabase client");

// For backward compatibility
export { supabase as supabaseClient };
export { supabase };
export { debugAssetMedia } from '@/integrations/supabase/client';
