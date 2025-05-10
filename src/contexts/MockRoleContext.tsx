import React, { createContext, useState, useContext, ReactNode } from 'react';

export type MockRole = 'logged-out' | 'logged-in' | 'admin' | 'owner' | null;

interface MockRoleContextType {
  mockRole: MockRole;
  setMockRole: (role: MockRole) => void;
  isStaging: boolean; // To control visibility of the switcher
  mockOwnerId: string | null; // Added: ID of the entity to view as owner
  setMockOwnerId: (id: string | null) => void; // Added: Function to set the owner ID
}

const MockRoleContext = createContext<MockRoleContextType | undefined>(undefined);

export const MockRoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mockRole, setMockRole] = useState<MockRole>(null);
  const [mockOwnerId, setMockOwnerId] = useState<string | null>(null); // Added state for owner ID
  // Use import.meta.env.MODE provided by Vite
  const isStaging = import.meta.env.MODE === 'staging'; 
  console.log('[MockRoleContext] MODE:', import.meta.env.MODE, 'isStaging:', isStaging); // Debug log

  const handleSetMockRole = (role: MockRole) => {
    setMockRole(role);
    // If the role is not 'owner', clear the mockOwnerId
    if (role !== 'owner') {
      setMockOwnerId(null);
    }
  };

  return (
    <MockRoleContext.Provider value={{ mockRole, setMockRole: handleSetMockRole, isStaging, mockOwnerId, setMockOwnerId }}>
      {children}
    </MockRoleContext.Provider>
  );
};

export const useMockRoleContext = () => {
  const context = useContext(MockRoleContext);
  if (context === undefined) {
    throw new Error('useMockRoleContext must be used within a MockRoleProvider');
  }
  return context;
}; 