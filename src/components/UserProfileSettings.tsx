
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentUserProfile, updateUserProfile } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, X, Plus, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function UserProfileSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
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
          setDescription(userProfile?.description || '');
          setLinks(userProfile?.links || []);
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
        display_name: displayName.trim(),
        description: description.trim(),
        links: links
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

  const handleAddLink = () => {
    if (newLink && isValidUrl(newLink)) {
      // Make sure link has a protocol
      let linkToAdd = newLink;
      if (!/^https?:\/\//i.test(linkToAdd)) {
        linkToAdd = `https://${linkToAdd}`;
      }
      
      setLinks([...links, linkToAdd]);
      setNewLink('');
    } else {
      toast.error('Please enter a valid URL');
    }
  };

  const handleRemoveLink = (indexToRemove: number) => {
    setLinks(links.filter((_, index) => index !== indexToRemove));
  };

  // Check if a URL is valid
  const isValidUrl = (url: string) => {
    try {
      // If URL doesn't have a protocol, add https:// temporarily for validation
      const urlToCheck = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      new URL(urlToCheck);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLink();
    }
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
          
          <div className="space-y-2">
            <Label htmlFor="description">About Me</Label>
            <Textarea 
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell others about yourself"
              className="min-h-[100px] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              A brief description that will appear on your profile page
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="links">Links</Label>
            <div className="flex space-x-2">
              <Input 
                id="links"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add website link (e.g., github.com)"
                className="flex-grow"
              />
              <Button 
                type="button" 
                onClick={handleAddLink}
                size="icon"
                variant="outline"
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add links to your website, social media, or other profiles
            </p>
            
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {links.map((link, index) => {
                  const domain = new URL(link).hostname;
                  return (
                    <div 
                      key={index}
                      className="flex items-center gap-1 bg-muted/40 rounded-md px-2 py-1"
                    >
                      <div className="flex items-center gap-1">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${domain}`} 
                          alt=""
                          className="w-4 h-4"
                        />
                        <span className="text-sm truncate max-w-[150px]">{domain}</span>
                      </div>
                      <Button 
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleRemoveLink(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
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
          disabled={isSaving || isLoading || !displayName.trim() || (displayName === profile?.display_name && description === profile?.description && JSON.stringify(links) === JSON.stringify(profile?.links || []))}
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
