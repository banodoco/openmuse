
// This file is now deprecated as we're using the AuthProvider from useAuth.tsx
// It's kept for backward compatibility but doesn't actually do anything

import React from 'react';
import { Logger } from '@/lib/logger';

const logger = new Logger('AuthProvider-Legacy');

interface AuthProviderProps {
  children: React.ReactNode;
  onAuthStateChange?: (isLoading: boolean) => void;
}

// This is now just a pass-through component as we're using the AuthProvider from useAuth.tsx
const AuthProvider: React.FC<AuthProviderProps> = ({ children, onAuthStateChange }) => {
  React.useEffect(() => {
    if (onAuthStateChange) {
      logger.log('Legacy AuthProvider called, notifying parent component');
      // Just notify immediately that we're not loading
      onAuthStateChange(false);
    }
  }, [onAuthStateChange]);
  
  return <>{children}</>;
};

export default AuthProvider;
