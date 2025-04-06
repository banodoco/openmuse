import { createClient } from '@supabase/supabase-js';
import { Logger } from '@/lib/logger';

const logger = new Logger('SupabaseClient');

// Extract environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ujlwuvkrxlvoswwkerdf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHd1dmtyeGx2b3N3d2tlcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODM1MDYsImV4cCI6MjA1NzM1OTUwNn0.htwJHr4Z4NlMZYVrH1nNGkU53DyBTWgMeOeUONYFy_4';

logger.log('Initializing Supabase client with enhanced session configuration');

// Create the Supabase client with detailed session persistence configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit', // Ensures implicit flow for better session handling
    debug: true // Enable auth debugging
  }
});

// Log connection information for debugging
logger.log('Supabase client initialized:', { 
  url: supabaseUrl.substring(0, 20) + '...', 
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'implicit'
});

// Add a helper function to check for issues with persistent session storage
export const checkSessionStorage = () => {
  try {
    // Test if localStorage is available
    const testKey = 'supabase_test_storage';
    localStorage.setItem(testKey, 'test');
    const value = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    
    if (value !== 'test') {
      logger.error('LocalStorage not working correctly - session persistence may fail');
      return false;
    }
    
    // Check if we can access the stored session
    const sessionStr = localStorage.getItem('supabase.auth.token');
    if (!sessionStr) {
      logger.log('No session found in localStorage');
      return false;
    }
    
    logger.log('Session storage check passed - localStorage available and session exists');
    return true;
  } catch (error) {
    logger.error('Error checking session storage:', error);
    return false;
  }
};

// Automatically check session storage on import
checkSessionStorage();

export const testRLSPermissions = async () => {
  try {
    logger.log('Testing RLS permissions');
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id')
      .limit(1);
      
    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('id')
      .limit(1);
    
    const result = {
      assetsAccess: !assetsError && Array.isArray(assets),
      mediaAccess: !mediaError && Array.isArray(media)
    };
    
    logger.log('RLS permissions test result:', result);
    return result;
  } catch (error) {
    logger.error("Error testing RLS permissions:", error);
    return {
      assetsAccess: false,
      mediaAccess: false
    };
  }
};

export const debugAssetMedia = async (assetId: string) => {
  logger.log(`Debugging asset media for asset: ${assetId}`);
  const { data, error } = await supabase
    .from('asset_media')
    .select('*')
    .eq('asset_id', assetId);
  
  if (error) {
    logger.error('Error fetching asset_media relationships:', error);
    return [];
  }
  
  logger.log(`Found ${data?.length || 0} asset_media relationships`);
  return data || [];
};

// Add a debug function to check current session
export const debugCurrentSession = async () => {
  try {
    logger.log('Debug: Checking current session');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      logger.error('Debug: Error getting session:', error);
      return null;
    }
    
    if (data.session) {
      logger.log('Debug: Session found:', {
        userId: data.session.user.id,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
        refreshToken: !!data.session.refresh_token,
      });
      return data.session;
    }
    
    logger.log('Debug: No session found');
    return null;
  } catch (error) {
    logger.error('Debug: Unexpected error checking session:', error);
    return null;
  }
};

// Add a debug function to inspect the assets table structure
export const debugAssetsTable = async () => {
  try {
    logger.log('Debugging assets table structure');
    
    // First, get a single row to examine structure
    const { data: sampleAsset, error: sampleError } = await supabase
      .from('assets')
      .select('*')
      .limit(1)
      .single();
      
    if (sampleError) {
      logger.error('Error fetching sample asset:', sampleError);
      return { structure: null, sample: null, error: sampleError };
    }
    
    // Log the sample to see actual structure
    logger.log('Sample asset structure:', sampleAsset);
    
    // Now specifically check if lora_base_model exists
    const { data: loraModelCheck, error: modelError } = await supabase
      .rpc('debug_get_all_assets')
      .limit(5);
      
    if (modelError) {
      logger.error('Error checking for lora_base_model field:', modelError);
    } else {
      logger.log('Assets from debug function (first 5):', loraModelCheck);
    }
    
    return { 
      structure: Object.keys(sampleAsset || {}), 
      sample: sampleAsset,
      debug: loraModelCheck
    };
  } catch (error) {
    logger.error('Error debugging assets table:', error);
    return { structure: null, sample: null, error };
  }
};

// Add a function to debug the columns of a table
export const debugTableColumns = async (tableName: string) => {
  try {
    logger.log(`Debugging columns for table: ${tableName}`);
    
    const { data, error } = await supabase.rpc('debug_column_exists', {
      table_name: tableName,
      column_name: 'lora_base_model'
    });
    
    if (error) {
      logger.error(`Error checking for column in ${tableName}:`, error);
      return null;
    }
    
    logger.log(`Column 'lora_base_model' exists in ${tableName}: ${data}`);
    
    // Also get all column names from information schema
    const { data: columnsData, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', tableName);
      
    if (columnsError) {
      logger.error(`Error getting columns for ${tableName}:`, columnsError);
    } else {
      logger.log(`All columns in ${tableName}:`, columnsData);
    }
    
    return { 
      lora_base_model_exists: data,
      columns: columnsData 
    };
  } catch (error) {
    logger.error(`Error debugging table columns for ${tableName}:`, error);
    return null;
  }
};

// Add a function to debug a specific asset
export const debugAsset = async (assetId: string) => {
  try {
    logger.log(`Debugging specific asset: ${assetId}`);
    
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();
      
    if (error) {
      logger.error(`Error fetching asset ${assetId}:`, error);
      return null;
    }
    
    logger.log(`Asset ${assetId} details:`, data);
    
    // Check if lora_base_model exists in this asset
    const hasLoraBaseModel = 'lora_base_model' in data;
    logger.log(`Asset has lora_base_model field: ${hasLoraBaseModel}`);
    
    // Also check if the column exists in the table
    await debugTableColumns('assets');
    
    return {
      ...data,
      _debug: {
        hasLoraBaseModel,
        allFields: Object.keys(data)
      }
    };
  } catch (error) {
    logger.error(`Error debugging asset ${assetId}:`, error);
    return null;
  }
};
