import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentUserProfile, updateUserProfile } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, X, Plus, Camera, Image as ImageIcon, Check, Pencil, ExternalLink, HelpCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

export default function UserProfileSettings() {
  const { user } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [realName, setRealName] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [editingLinkValue, setEditingLinkValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  const [isUsernameValid, setIsUsernameValid] = useState(true);

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameCheckError, setUsernameCheckError] = useState<string | null>(null);
  const initialUsername = useRef<string | null>(null);
  const initialDisplayName = useRef<string | null>(null);
  const initialRealName = useRef<string | null>(null);
  const initialDescription = useRef<string | null>(null);
  const initialLinks = useRef<string[] | null>(null);
  const initialAvatarUrl = useRef<string | null>(null);
  const initialBackgroundImageUrl = useRef<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        try {
          setIsLoading(true);
          setIsUsernameAvailable(null);
          setUsernameCheckError(null);
          const userProfile = await getCurrentUserProfile();
          setProfile(userProfile);
          const loadedUsername = userProfile?.username || '';
          setUsername(loadedUsername);
          initialUsername.current = loadedUsername;
          const loadedDisplayName = userProfile?.display_name || userProfile?.username || '';
          setDisplayName(loadedDisplayName);
          initialDisplayName.current = loadedDisplayName;
          const loadedRealName = userProfile?.real_name || '';
          setRealName(loadedRealName);
          initialRealName.current = loadedRealName;
          const loadedDescription = userProfile?.description || '';
          setDescription(loadedDescription);
          initialDescription.current = loadedDescription;
          const loadedLinks = userProfile?.links || [];
          setLinks(loadedLinks);
          initialLinks.current = loadedLinks;
          const loadedAvatarUrl = userProfile?.avatar_url || '';
          setAvatarUrl(loadedAvatarUrl);
          initialAvatarUrl.current = loadedAvatarUrl;
          const loadedBackgroundImageUrl = userProfile?.background_image_url || '';
          setBackgroundImageUrl(loadedBackgroundImageUrl);
          initialBackgroundImageUrl.current = loadedBackgroundImageUrl;
          setIsUsernameValid(true);
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

  const debouncedCheckUsername = useCallback(
    debounce(async (nameToCheck: string) => {
      if (!nameToCheck || nameToCheck.trim().length < 3) {
         setIsUsernameAvailable(null);
         setIsCheckingUsername(false);
         setUsernameCheckError(null);
        return;
      }
      if (nameToCheck === initialUsername.current) {
         setIsUsernameAvailable(true);
         setIsCheckingUsername(false);
         setUsernameCheckError(null);
         return;
      }

      setIsCheckingUsername(true);
      setIsUsernameAvailable(null);
      setUsernameCheckError(null);

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session?.access_token) {
           throw new Error('Authentication error. Cannot check username.');
        }

        const { data, error: funcError } = await supabase.functions.invoke('check-username-availability', {
          body: { username: nameToCheck },
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
        });

        if (funcError) {
           console.error('Supabase function error:', funcError);
           throw new Error(`Failed to check username: ${funcError.message}`);
        }

        if (data?.isAvailable === true) {
          setIsUsernameAvailable(true);
        } else if (data?.isAvailable === false) {
          setIsUsernameAvailable(false);
        } else {
          throw new Error('Unexpected response from availability check.');
        }
      } catch (err: any) {
        console.error("Username check failed:", err);
        setIsUsernameAvailable(null);
        setUsernameCheckError(err.message || "Could not verify username availability.");
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500),
    [initialUsername]
  );

  useEffect(() => {
    const isValidLength = !username || username.trim().length >= 3;
    setIsUsernameValid(isValidLength);

    if (isValidLength && username !== initialUsername.current) {
       debouncedCheckUsername(username);
    } else {
       setIsCheckingUsername(false);
       setIsUsernameAvailable(username === initialUsername.current ? true : null);
       setUsernameCheckError(null);
    }
  }, [username, debouncedCheckUsername, initialUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isUsernameValid) {
      toast({
        title: "Validation Error",
        description: 'Username must be at least 3 characters long',
        variant: "destructive"
      });
      return;
    }
    
    if (isUsernameAvailable === false) {
      toast({
        title: "Validation Error",
        description: 'Username is already taken. Please choose another.',
        variant: "destructive"
      });
      return;
    }
    
    if (isUsernameAvailable === null && username !== initialUsername.current) {
       toast({
         title: "Validation Error",
         description: 'Please wait for username availability check to complete.',
         variant: "destructive"
       });
       return;
    }
    
    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      toast({
        title: "Validation Error",
        description: 'Display name cannot be empty',
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      const updatedProfile = await updateUserProfile({
        username: username.trim(),
        display_name: displayName.trim(),
        real_name: realName.trim(),
        description: description.trim(),
        links: links,
        avatar_url: avatarUrl,
        background_image_url: backgroundImageUrl
      });
      
      if (updatedProfile) {
        setProfile(updatedProfile);
        initialUsername.current = updatedProfile.username;
        setUsername(updatedProfile.username);
        initialDisplayName.current = updatedProfile.display_name || '';
        setDisplayName(updatedProfile.display_name || '');
        initialRealName.current = updatedProfile.real_name || '';
        setRealName(updatedProfile.real_name || '');
        initialDescription.current = updatedProfile.description || '';
        setDescription(updatedProfile.description || '');
        initialLinks.current = updatedProfile.links || [];
        setLinks(updatedProfile.links || []);
        initialAvatarUrl.current = updatedProfile.avatar_url || '';
        setAvatarUrl(updatedProfile.avatar_url || '');
        initialBackgroundImageUrl.current = updatedProfile.background_image_url || '';
        setBackgroundImageUrl(updatedProfile.background_image_url || '');
        setIsUsernameAvailable(null);
        setJustSaved(true);
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });
        setTimeout(() => {
          setJustSaved(false);
        }, 2000);
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      if (err.message?.toLowerCase().includes('username is already taken')) {
         setIsUsernameAvailable(false);
         setUsernameCheckError(err.message);
      } else {
         setError(err.message || 'Failed to update profile');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLink = () => {
    if (newLink && isValidUrl(newLink)) {
      let linkToAdd = newLink;
      if (!/^https?:\/\//i.test(linkToAdd)) {
        linkToAdd = `https://${linkToAdd}`;
      }
      
      setLinks([...links, linkToAdd]);
      setNewLink('');
      setError(null);
    } else {
      setError('Please enter a valid URL');
    }
  };

  const handleRemoveLink = (indexToRemove: number) => {
    setLinks(links.filter((_, index) => index !== indexToRemove));
  };

  const isValidUrl = (url: string) => {
    try {
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

  const handleAvatarClick = () => {
    avatarFileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
         toast({ title: "Error", description: "Avatar image cannot exceed 5MB.", variant: "destructive" });
         return;
       }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackgroundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
         toast({ title: "Error", description: "Background image cannot exceed 10MB.", variant: "destructive" });
         return;
       }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setBackgroundImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackgroundImageClick = () => {
    backgroundFileInputRef.current?.click();
  };

  const handleEditLink = (index: number) => {
    setEditingLinkIndex(index);
    setEditingLinkValue(links[index]);
  };

  const handleSaveEditedLink = (index: number) => {
    if (editingLinkValue && isValidUrl(editingLinkValue)) {
      let linkToSave = editingLinkValue;
      if (!/^https?:\/\//i.test(linkToSave)) {
        linkToSave = `https://${linkToSave}`;
      }
      
      const newLinks = [...links];
      newLinks[index] = linkToSave;
      setLinks(newLinks);
      setEditingLinkIndex(null);
      setEditingLinkValue('');
      setError(null);
    } else {
      setError('Please enter a valid URL');
    }
  };

  const handleCancelEdit = () => {
    setEditingLinkIndex(null);
    setEditingLinkValue('');
  };

  const hasPendingChanges = (
    username !== initialUsername.current ||
    displayName !== (profile?.display_name || profile?.username || '') ||
    realName !== (profile?.real_name || '') ||
    description !== (profile?.description || '') ||
    JSON.stringify(links) !== JSON.stringify(profile?.links || []) ||
    avatarUrl !== (profile?.avatar_url || '') ||
    backgroundImageUrl !== (profile?.background_image_url || '')
  );

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Profile Settings</CardTitle>
          <a 
            href={`${location.pathname}?loggedOutView=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="View public profile"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View Public
          </a>
        </div>
        <CardDescription>
          Update your profile information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group mb-6">
            {backgroundImageUrl ? (
              <div 
                className="w-full h-48 bg-cover bg-center rounded-lg cursor-pointer" 
                style={{ backgroundImage: `url(${backgroundImageUrl})` }}
                onClick={handleBackgroundImageClick}
              >
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ImageIcon className="h-8 w-8 text-white" />
                </div>
              </div>
            ) : (
              <div 
                className="w-full h-48 bg-muted/30 rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handleBackgroundImageClick}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Add Background Image</span>
              </div>
            )}
            <input 
              type="file" 
              ref={backgroundFileInputRef} 
              onChange={handleBackgroundFileChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          <div className="flex justify-center mb-6 -mt-20 relative z-10">
            <div className="relative group">
              <Avatar className="h-24 w-24 cursor-pointer border-4 border-white shadow-lg -mt-16" onClick={handleAvatarClick}>
                <AvatarImage src={avatarUrl || ''} alt={profile?.display_name || profile?.username} />
                <AvatarFallback>
                  {profile ? getInitials(profile.display_name || profile.username) : '??'}
                </AvatarFallback>
              </Avatar>
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={handleAvatarClick}
              >
                <Camera className="h-6 w-6 text-white" />
              </div>
              <input 
                type="file" 
                ref={avatarFileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="username">Username</Label>
              {username !== initialUsername.current && (
                <span className="text-xs text-muted-foreground italic">(Needs saving)</span>
              )}
            </div>
            {!isUsernameValid && username.trim().length > 0 && (
              <p className="text-sm text-destructive">
                Username must be at least 3 characters long.
              </p>
            )}
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your unique username (min 3 chars)"
              minLength={3}
              maxLength={50}
              required
              className={
                !isUsernameValid && username.trim().length > 0 ? 'border-destructive'
                : (isUsernameAvailable === false ? 'border-destructive'
                    : (isUsernameAvailable === true ? 'border-green-500' : ''))
              }
              aria-describedby="username-feedback"
            />
            <div id="username-feedback" className="text-sm min-h-[20px]">
              {isCheckingUsername ? (
                <span className="text-muted-foreground italic flex items-center">
                   <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Checking availability...
                 </span>
              ) : usernameCheckError ? (
                 <span className="text-destructive flex items-center">
                   <X className="mr-1 h-3 w-3" /> {usernameCheckError}
                 </span>
               ) : isUsernameAvailable === true && username !== initialUsername.current ? (
                 <span className="text-green-600 flex items-center">
                   <Check className="mr-1 h-3 w-3" /> Username available!
                 </span>
               ) : isUsernameAvailable === false ? (
                 <span className="text-destructive flex items-center">
                   <X className="mr-1 h-3 w-3" /> Username already taken.
                 </span>
               ) : username !== initialUsername.current && isUsernameValid ? (
                 <span className="text-muted-foreground italic">
                   Remember to save changes.
                 </span>
               ) : (
                  <span className="text-muted-foreground">
                    Your unique identifier on the site. Must be at least 3 characters.
                  </span>
               )}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="display_name">Display Name</Label>
              {displayName !== initialDisplayName.current && (
                 <span className="text-xs text-muted-foreground italic">(Needs saving)</span>
              )}
            </div>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want your name displayed"
              maxLength={100}
              required
              className={error && error.toLowerCase().includes('display name') ? 'border-destructive' : ''}
            />
            <p className="text-sm text-muted-foreground">
              How your name appears publicly (e.g., on leaderboards, comments).
            </p>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="discord_username">Discord Username</Label>
            <Input id="discord_username" value={profile?.discord_username || 'N/A'} readOnly disabled />
            <p className="text-sm text-muted-foreground">Synced automatically from Discord. Cannot be changed here.</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="real_name">Real Name (Optional)</Label>
              {realName !== initialRealName.current && (
                <span className="text-xs text-muted-foreground italic">(Needs saving)</span>
              )}
            </div>
            <Input
              id="real_name"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="Your real name (private)"
              maxLength={100}
            />
            <p className="text-sm text-muted-foreground">
              Only visible to administrators.
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">About Me</Label>
              {description !== initialDescription.current && (
                <span className="text-xs text-muted-foreground italic">(Needs saving)</span>
              )}
            </div>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="links">Links</Label>
              {JSON.stringify(links) !== JSON.stringify(initialLinks.current || []) && (
                <span className="text-xs text-muted-foreground italic">(Needs saving)</span>
              )}
            </div>
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
                  let domain;
                  try {
                    domain = new URL(link).hostname;
                  } catch (e) {
                    domain = link;
                  }
                  
                  return (
                    <HoverCard key={index}>
                      <HoverCardTrigger>
                        <div className="relative flex items-center justify-center">
                          {editingLinkIndex === index ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingLinkValue}
                                onChange={(e) => setEditingLinkValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveEditedLink(index);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                                className="w-48 h-8 text-xs"
                                autoFocus
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleSaveEditedLink(index)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-center w-10 h-10 bg-muted/30 hover:bg-muted/50 rounded-full transition-colors">
                                <img 
                                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                                  alt=""
                                  className="w-6 h-6 object-contain"
                                />
                              </div>
                              <div className="flex gap-1 absolute -top-2 -right-2">
                                <Button 
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 rounded-full bg-muted p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditLink(index);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button 
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 rounded-full bg-muted p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveLink(index);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="p-2 text-xs">
                        {editingLinkIndex === index ? editingLinkValue : domain}
                      </HoverCardContent>
                    </HoverCard>
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
      <CardFooter className="flex flex-col gap-4">
        <Button
          onClick={handleSubmit}
          disabled={
             isSaving ||
             isLoading ||
             !hasPendingChanges ||
             !isUsernameValid ||
             !displayName.trim() ||
             isCheckingUsername ||
             isUsernameAvailable === false
           }
          className="w-full"
          variant={justSaved ? "outline" : "default"}
        >
          {isSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : justSaved ? (
            <><Check className="mr-2 h-4 w-4" /> Changes Saved</>
          ) : (
            'Save Changes'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
