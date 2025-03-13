
import { supabaseDB } from './supabaseDB';

// A wrapper that always uses Supabase database
class DatabaseSwitcher {
  // Always return the Supabase database
  getDatabase() {
    console.log('Using Supabase database');
    return supabaseDB;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
