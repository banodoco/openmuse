
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LogOut, LogIn, User, Book } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUserProfile } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { Logger } from '@/lib/logger';

const logger = new Logger('AuthButton');

const AuthButton: React.FC = () => {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [isLoading]);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        setIsLoadingProfile(true);
        try {
          const profile = await getCurrentUserProfile();
          setUserProfile(profile);
        } catch (error) {
          logger.error('Error fetching user profile:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      } else {
        setUserProfile(null);
      }
    };
    
    fetchUserProfile();
  }, [user]);
  
  const handleSignIn = () => {
    navigate('/auth');
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      logger.error('Error signing out:', error);
    }
  };

  const handleProfileClick = () => {
    // If user is logged in and has a profile, navigate to their profile
    if (user) {
      const displayName = userProfile?.display_name || userProfile?.username || user.user_metadata.preferred_username;
      
      if (displayName) {
        navigate(`/profile/${encodeURIComponent(displayName)}`);
      } else {
        // Fallback to a generic profile route if no display name is available
        navigate('/profile');
      }
    }
  };
  
  const getDisplayName = () => {
    if (userProfile) {
      return userProfile.display_name || userProfile.username;
    }
    return user?.user_metadata.preferred_username || 'User';
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  if (isLoading && !loadingTimeout) {
    return (
      <Button variant="ghost" disabled className="animate-pulse">
        <div className="h-5 w-20 bg-muted rounded" />
      </Button>
    );
  }
  
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button 
          variant="link" 
          onClick={() => navigate('/manifesto')}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Book className="h-4 w-4 mr-1" />
          Manifesto
        </Button>
        <Button 
          variant="outline" 
          onClick={handleSignIn}
          className="flex items-center gap-2 border-olive/30 text-olive h-12"
        >
          <LogIn className="h-4 w-4" />
          Sign In
        </Button>
      </div>
    );
  }
  
  const displayName = getDisplayName();
  
  return (
    <div className="flex flex-col items-stretch gap-2">
      <Button 
        variant="outline" 
        className="flex items-center gap-2 border-2 border-olive/40 text-olive shadow-sm hover:bg-cream pl-2 pr-3 h-16"
        onClick={handleProfileClick}
      >
        {userProfile?.avatar_url ? (
          <Avatar className="h-8 w-8 mr-1">
            <AvatarImage src={userProfile.avatar_url} alt={displayName} />
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
        ) : (
          <User className="h-4 w-4" />
        )}
        {isLoadingProfile ? '...' : displayName}
      </Button>
      
      <Button 
        variant="ghost" 
        className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-cream/50 text-xs"
        onClick={handleSignOut}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
};

export default AuthButton;
