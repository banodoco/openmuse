import React, { useEffect, useState } from 'react';
import { useMockRoleContext, MockRole } from '../../contexts/MockRoleContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'; // Assuming shadcn/ui select
import { useLocation } from 'react-router-dom';

const RoleSwitcher: React.FC = () => {
  const { mockRole, setMockRole, isStaging, setMockOwnerId, mockOwnerId } = useMockRoleContext();
  const location = useLocation();

  const [pageOwnerId, setPageOwnerId] = useState<string | null>(null);
  const [isOwnablePage, setIsOwnablePage] = useState(false);

  useEffect(() => {
    console.log('[RoleSwitcher] useEffect triggered');
    console.log('[RoleSwitcher] pathname:', location.pathname);

    const profilePattern = /^\/profile\/([^\/]+)/;
    const assetPattern = /^\/assets\/(?:loras\/)?([^\/]+)/;

    const profileMatch = location.pathname.match(profilePattern);
    const assetMatch = location.pathname.match(assetPattern);

    console.log('[RoleSwitcher] profileMatch:', profileMatch);
    console.log('[RoleSwitcher] assetMatch:', assetMatch);

    let currentOwnerId: string | null = null;
    let ownable = false;

    if (profileMatch && profileMatch[1]) { 
      currentOwnerId = profileMatch[1];
      ownable = true;
      console.log('[RoleSwitcher] Matched profile page. Owner ID:', currentOwnerId);
    } else if (assetMatch && assetMatch[1]) {
      currentOwnerId = assetMatch[1];
      ownable = true;
      console.log('[RoleSwitcher] Matched asset/LoRA page. Owner ID:', currentOwnerId);
    } else {
      console.log('[RoleSwitcher] No ownable page pattern matched.');
    }
    
    setIsOwnablePage(ownable);
    setPageOwnerId(currentOwnerId);
    console.log('[RoleSwitcher] isOwnablePage set to:', ownable, 'pageOwnerId set to:', currentOwnerId);

    if (!ownable && mockRole === 'owner') {
      console.log('[RoleSwitcher] Not on ownable page, but mockRole is owner. Resetting role.');
      setMockRole(null); 
      setMockOwnerId(null);
    }

  }, [location.pathname, mockRole, setMockRole, setMockOwnerId]);

  if (!isStaging) {
    return null;
  }

  const baseRoles: MockRole[] = ['logged-out', 'logged-in', 'admin'];

  const handleRoleChange = (value: string) => {
    const newRole = value === 'null' ? null : (value as MockRole);
    if (newRole === 'owner' && pageOwnerId) {
      setMockOwnerId(pageOwnerId);
      setMockRole('owner');
    } else {
      setMockRole(newRole);
      // setMockOwnerId(null); // This is handled by handleSetMockRole in context now
    }
  };
  
  // Determine the current value for the Select component
  let selectValue: string = mockRole || 'null';
  if (mockRole === 'owner' && mockOwnerId && mockOwnerId !== pageOwnerId) {
    // If we are in 'owner' mode but navigated away from the page we were mocking ownership of,
    // reset to 'None' to avoid confusion.
    selectValue = 'null';
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '10px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      borderRadius: '8px',
      zIndex: 10000, // Ensure it's on top
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}>
      <span>Mock Role:</span>
      <Select onValueChange={handleRoleChange} value={selectValue}>
        <SelectTrigger className="w-[180px] bg-gray-800 text-white border-gray-700">
          <SelectValue placeholder="Select Role" />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 text-white">
          <SelectItem value={'null'} className="hover:bg-gray-700">None (Actual Role)</SelectItem>
          {baseRoles.map((role) => (
            <SelectItem key={role} value={role!} className="hover:bg-gray-700">
              {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'None'}
            </SelectItem>
          ))}
          {isOwnablePage && pageOwnerId && (
            <SelectItem value={'owner'} className="hover:bg-gray-700">
              View as Owner ({pageOwnerId.substring(0,8)}...)
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default RoleSwitcher; 