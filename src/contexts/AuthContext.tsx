import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin?: boolean; // Add isAdmin property to track admin status
  isLeader?: boolean; // Track if this tab is the leader for auth actions
};

// Create the auth context with default values
export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAdmin: false, // Default to false for safety
  isLeader: false, // Default leader status
  signIn: async () => {},
  signOut: async () => {},
});
