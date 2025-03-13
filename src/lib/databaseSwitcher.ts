
import { supabaseDB } from './supabaseDB';

// A database provider that always returns Supabase database
class DatabaseSwitcher {
  getDatabase() {
    console.log('Using Supabase database');
    return supabaseDB;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
