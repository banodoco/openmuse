
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

// Export the hook for using the auth context
export const useAuth = () => useContext(AuthContext);

// Re-export the AuthProvider for convenience
export { AuthProvider } from '@/providers/AuthProvider';
