import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, LogIn, User, Book } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUserProfile } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { Logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const logger = new Logger('AuthButton');

const AuthButton: React.FC = () => {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    // If user is logged in and has a profile with a username, navigate there
    if (user && userProfile?.username) {
      navigate(`/profile/${userProfile.username}`); // Use username directly
    } else if (user) {
      // Log an error or navigate to a safe fallback like home or settings
      // This case should ideally not happen if a logged-in user always has a profile
      logger.warn('Profile button clicked, but user profile or username is missing. Navigating home.', { userId: user.id, profileExists: !!userProfile });
      navigate('/'); 
    }
    // If no user, the button shouldn't be clickable in this state anyway
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
  
  const isManifestoActive = location.pathname === '/manifesto';
  
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
          className={cn(
            "flex items-center gap-1 text-sm font-medium transition-colors",
            isManifestoActive 
              ? "text-olive underline font-semibold"
              : "text-muted-foreground hover:text-foreground hover:underline"
          )}
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
    <div className="relative group flex flex-col items-stretch gap-2">
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
        size="icon"
        className={cn(
          // Mobile: Full width, centered content
          "mb-2 w-full flex justify-end",
          // Desktop: Reset width and position for corner overlap
          "md:w-auto md:absolute md:-top-2 md:-right-2 md:mb-0",
          "z-10 flex items-center rounded-full",
          "h-7 px-2",
          "bg-background/70 backdrop-blur-sm text-muted-foreground",
          "border border-olive/30",
          "transition-all duration-200 ease-in-out",
          "md:h-6 md:w-6 md:px-0 md:justify-center",
          "md:group-hover:scale-110",
          "md:hover:bg-muted/90 md:hover:text-foreground md:hover:w-auto md:hover:px-2",
          "md:hover:border-olive/50"
        )}
        onClick={(e) => {
          e.stopPropagation();
          handleSignOut();
        }}
        aria-label="Sign out"
      >
        <LogOut className="h-3 w-3 flex-shrink-0" />
        <span className={cn(
          "ml-1 text-xs font-medium",
          "inline md:hidden md:group-[.hover\\:w-auto]:inline"
        )}>
          Sign out
        </span>
      </Button>
    </div>
  );
};

export default AuthButton;
