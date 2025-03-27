
// This file is maintained for backward compatibility
// It re-exports the Supabase database implementation
import { supabaseDatabaseOperations } from './database/SupabaseDatabaseOperations';

console.log("supabaseDB.ts: Re-exporting the Supabase database implementation for backward compatibility");

export { supabaseDatabaseOperations as supabaseDB };
