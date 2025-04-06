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
