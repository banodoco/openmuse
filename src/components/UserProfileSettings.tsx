
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrentUserProfile, updateUserProfile } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UserProfileSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        try {
          setIsLoading(true);
          const userProfile = await getCurrentUserProfile();
          setProfile(userProfile);
          setDisplayName(userProfile?.display_name || userProfile?.username || '');
        } catch (err) {
          console.error('Error loading profile:', err);
          setError('Failed to load profile information');
        } finally {
          setIsLoading(false);
        }
      }
    }
    
    loadProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      const updatedProfile = await updateUserProfile({
        display_name: displayName.trim()
      });
      
      if (updatedProfile) {
        setProfile(updatedProfile);
        toast.success('Profile updated successfully');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Update the ProfilePage button handler to use this
  const handleSaveChanges = () => {
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    
    handleSubmit(new Event('submit') as unknown as React.FormEvent);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Update your profile information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center mb-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url || ''} alt={profile?.display_name || profile?.username} />
              <AvatarFallback>
                {profile ? getInitials(profile.display_name || profile.username) : '??'}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username">Username (From Discord)</Label>
            <Input 
              id="username"
              value={profile?.username || ''}
              disabled
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              This is your Discord username and cannot be changed
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input 
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your preferred display name"
            />
            <p className="text-xs text-muted-foreground">
              This is the name that will be displayed to other users. It must be unique.
            </p>
          </div>
          
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {error}
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={isSaving || isLoading || !displayName.trim() || displayName === profile?.display_name}
          className="w-full"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
