import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin?: boolean; // Add isAdmin property to track admin status
  isLeader?: boolean; // NEW: Track if the current tab is the leader
};

// Create the auth context with default values
export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAdmin: false, // Default to false for safety
  isLeader: false, // Default leader status to false
  signIn: async () => {},
  signOut: async () => {},
});
