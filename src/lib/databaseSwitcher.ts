
import { videoDB } from './db';
import { supabaseDB } from './supabaseDB';
import { remoteStorage } from './remoteStorage';

// A wrapper that switches between local and Supabase database based on the storage config
class DatabaseSwitcher {
  // Get the appropriate database based on the current storage config
  getDatabase() {
    const config = remoteStorage.getConfig();
    console.log('Current storage config:', config.type);
    
    if (config.type === 'supabase') {
      console.log('Using Supabase database');
      return supabaseDB;
    } else {
      console.log('Using local database');
      return videoDB;
    }
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
