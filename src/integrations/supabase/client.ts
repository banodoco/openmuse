
import { createClient } from '@supabase/supabase-js';

// Use hardcoded values for the Supabase project when environment variables aren't available
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ujlwuvkrxlvoswwkerdf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHd1dmtyeGx2b3N3d2tlcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODM1MDYsImV4cCI6MjA1NzM1OTUwNn0.htwJHr4Z4NlMZYVrH1nNGkU53DyBTWgMeOeUONYFy_4';

// Create the Supabase client with explicit session handling configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

export const testRLSPermissions = async () => {
  try {
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id')
      .limit(1);
      
    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('id')
      .limit(1);
    
    return {
      assetsAccess: !assetsError && Array.isArray(assets),
      mediaAccess: !mediaError && Array.isArray(media)
    };
  } catch (error) {
    console.error("Error testing RLS permissions:", error);
    return {
      assetsAccess: false,
      mediaAccess: false
    };
  }
};

// Add this function to debug asset media relationships
export const debugAssetMedia = async (assetId: string) => {
  const { data, error } = await supabase
    .from('asset_media')
    .select('*')
    .eq('asset_id', assetId);
  
  if (error) {
    console.error('Error fetching asset_media relationships:', error);
    return [];
  }
  
  return data || [];
};
