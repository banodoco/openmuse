
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
