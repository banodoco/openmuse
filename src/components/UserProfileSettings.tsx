import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentUserProfile, updateUserProfile } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, X, Plus, Camera, Image as ImageIcon, Check, Pencil, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useSearchParams } from 'react-router-dom';

export default function UserProfileSettings() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const isPreviewMode = searchParams.get('preview') === 'true' || !user || (profile && user.id !== profile.id);
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

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        try {
          setIsLoading(true);
          const userProfile = await getCurrentUserProfile();
          setProfile(userProfile);
          if (userProfile && user.id === userProfile.id && searchParams.get('preview') !== 'true') {
            setDisplayName(userProfile.display_name || userProfile.username || '');
            setRealName(userProfile.real_name || '');
            setDescription(userProfile.description || '');
            setLinks(userProfile.links || []);
            setAvatarUrl(userProfile.avatar_url || '');
            setBackgroundImageUrl(userProfile.background_image_url || '');
          }
        } catch (err) {
          console.error('Error loading profile:', err);
          setError('Failed to load profile information');
        } finally {
          setIsLoading(false);
        }
      }
    }
    
    loadProfile();
  }, [user, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      const updatedProfile = await updateUserProfile({
        display_name: displayName.trim(),
        real_name: realName.trim(),
        description: description.trim(),
        links: links,
        avatar_url: avatarUrl,
        background_image_url: backgroundImageUrl
      });
      
      if (updatedProfile) {
        setProfile(updatedProfile);
        setJustSaved(true);
        setTimeout(() => {
          setJustSaved(false);
        }, 2000);
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
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    if (backgroundFileInputRef.current) {
      backgroundFileInputRef.current.click();
    }
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Update your profile information
          </CardDescription>
        </div>
        {!isPreviewMode && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => window.open(`${window.location.pathname}?preview=true`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Preview Profile
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isPreviewMode ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-medium">Username</h3>
              <p>{profile?.username || ''}</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium">Display Name</h3>
              <p>{profile?.display_name || profile?.username || ''}</p>
            </div>
            
            {profile?.real_name && (
              <div className="space-y-2">
                <h3 className="font-medium">Real Name</h3>
                <p>{profile.real_name}</p>
              </div>
            )}
            
            {profile?.description && (
              <div className="space-y-2">
                <h3 className="font-medium">About Me</h3>
                <p className="whitespace-pre-wrap">{profile.description}</p>
              </div>
            )}
            
            {(profile?.links || []).length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Links</h3>
                <div className="flex flex-wrap gap-2">
                  {(profile?.links || []).map((link, index) => {
                    let domain;
                    try {
                      domain = new URL(link).hostname;
                    } catch (e) {
                      domain = link;
                    }
                    
                    return (
                      <HoverCard key={index}>
                        <HoverCardTrigger asChild>
                          <a 
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <div className="flex items-center justify-center w-10 h-10 bg-muted/30 hover:bg-muted/50 rounded-full transition-colors">
                              <img 
                                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                                alt=""
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                          </a>
                        </HoverCardTrigger>
                        <HoverCardContent className="p-2 text-xs">
                          {domain}
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative group mb-6">
              {backgroundImageUrl ? (
                <div 
                  className="w-full h-48 bg-cover bg-center rounded-lg cursor-pointer" 
                  style={{ backgroundImage: `url(${backgroundImageUrl})` }}
                  onClick={!isPreviewMode ? handleBackgroundImageClick : undefined}
                >
                  {!isPreviewMode && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ImageIcon className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  className={`w-full h-48 bg-muted/30 rounded-lg flex items-center justify-center ${!isPreviewMode ? 'cursor-pointer hover:bg-muted/50' : ''} transition-colors`}
                  onClick={!isPreviewMode ? handleBackgroundImageClick : undefined}
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  {!isPreviewMode && <span className="ml-2 text-muted-foreground">Add Background Image</span>}
                </div>
              )}
              {!isPreviewMode && (
                <input 
                  type="file" 
                  ref={backgroundFileInputRef} 
                  onChange={handleBackgroundFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              )}
            </div>
            <div className="flex justify-center mb-6 -mt-20 relative z-10">
              <div className="relative group">
                <Avatar className={`h-24 w-24 ${!isPreviewMode ? 'cursor-pointer' : ''} border-4 border-white shadow-lg -mt-16`} onClick={!isPreviewMode ? handleAvatarClick : undefined}>
                  <AvatarImage src={avatarUrl || ''} alt={profile?.display_name || profile?.username} />
                  <AvatarFallback>
                    {profile ? getInitials(profile.display_name || profile.username) : '??'}
                  </AvatarFallback>
                </Avatar>
                {!isPreviewMode && (
                  <>
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={handleAvatarClick}
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </>
                )}
              </div>
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
              <Label htmlFor="realName">Real Name (Optional)</Label>
              <Input 
                id="realName"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="Enter your real name (optional)"
              />
              <p className="text-xs text-muted-foreground">
                This will be displayed on your profile if provided
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
            
            {error && !isPreviewMode && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}
          </form>
        )}
      </CardContent>
      {!isPreviewMode && (
        <CardFooter className="flex flex-col gap-4">
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || isLoading || !displayName.trim() || (
              displayName === profile?.display_name && 
              realName === profile?.real_name && 
              description === profile?.description && 
              JSON.stringify(links) === JSON.stringify(profile?.links || []) &&
              avatarUrl === profile?.avatar_url &&
              backgroundImageUrl === profile?.background_image_url
            )}
            className="w-full"
            variant={justSaved ? "outline" : "default"}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : justSaved ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Changes Saved
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
