
import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

// Create the auth context with default values
export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});
