
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LogOut, LogIn, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

const logger = new Logger('AuthButton');

const AuthButton: React.FC = () => {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  
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
  
  // Show loading state while checking auth
  if (isLoading) {
    return (
      <Button variant="ghost" disabled className="animate-pulse">
        <div className="h-5 w-20 bg-muted rounded" />
      </Button>
    );
  }
  
  if (!user) {
    return (
      <Button 
        variant="outline" 
        onClick={handleSignIn}
        className="flex items-center gap-2"
      >
        <LogIn className="h-4 w-4" />
        Sign In
      </Button>
    );
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 border-2 shadow-sm hover:bg-secondary"
        >
          <User className="h-4 w-4" />
          {user.user_metadata.preferred_username || user.email || 'User'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSignOut} 
          className="text-destructive flex items-center cursor-pointer font-medium hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AuthButton;
