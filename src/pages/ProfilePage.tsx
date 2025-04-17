
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUserProfile } from '@/lib/auth';
import RequireAuth from '@/components/RequireAuth';
import LoadingState from '@/components/LoadingState';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const redirectToUserProfile = async () => {
      if (user) {
        try {
          const profile = await getCurrentUserProfile();
          
          if (profile?.display_name) {
            // Redirect to the user's profile page using their display name
            navigate(`/profile/${encodeURIComponent(profile.display_name)}`);
          } else {
            // If no display name is set, use the username
            navigate(`/profile/${encodeURIComponent(profile?.username || 'user')}`);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };
    
    redirectToUserProfile();
  }, [user, navigate]);

  return (
    <RequireAuth>
      <LoadingState />
    </RequireAuth>
  );
}
