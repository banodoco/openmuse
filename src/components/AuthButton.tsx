
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { signOut, getCurrentUserProfile } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { LogOut, LogIn, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const AuthButton: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change in AuthButton:', event);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          try {
            const profile = await getCurrentUserProfile();
            setUser(profile);
          } catch (error) {
            console.error('Error loading user profile after auth change:', error);
          } finally {
            setIsLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
        }
      }
    );
    
    // THEN check for existing session
    const loadUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await getCurrentUserProfile();
          setUser(profile);
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUserProfile();
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  const handleSignIn = () => {
    navigate('/auth');
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  if (isLoading) {
    return (
      <Button variant="ghost" disabled>
        <div className="animate-pulse h-5 w-20 bg-muted rounded" />
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
        <Button variant="outline" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          {user.username}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AuthButton;
