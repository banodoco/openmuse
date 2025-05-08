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
import { Loader2, X, Plus, Camera, Image as ImageIcon, Check, Pencil, ExternalLink, HelpCircle, Trash2, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

// Skeleton Loader Component
function UserProfileSettingsSkeleton() {
  return (
    <Card className="max-w-2xl mx-auto my-8 bg-card/80 backdrop-blur-sm border border-border/20">
      <CardHeader>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Image Section Skeleton */}
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-1/4 mb-1" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>

        {/* Text Inputs Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>

        {/* Links Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
      <CardFooter className="border-t pt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-2">
        <Skeleton className="h-10 w-full sm:w-40" />
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
           <Skeleton className="h-10 w-full sm:w-32" />
           <Skeleton className="h-10 w-full sm:w-32" />
        </div>
      </CardFooter>
    </Card>
  );
}

// Modify the ReminderText component for fade effect
function ReminderText({ isVisible }: { isVisible: boolean }) {
  return (
    <p 
      className={cn(
        "text-xs text-muted-foreground mt-1 italic transition-opacity duration-500 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      You must 'Save Changes' below
    </p>
  );
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

  // State for HuggingFace API Key
  const [huggingFaceApiKey, setHuggingFaceApiKey] = useState('');
  const [initialHuggingFaceApiKey, setInitialHuggingFaceApiKey] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Add state for reminder logic
  const [lastChangeTimestamp, setLastChangeTimestamp] = useState<number | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const reminderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track if reminder should be rendered (allows fade-out before removal/hiding)
  const [isReminderRendered, setIsReminderRendered] = useState(false);

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

          // Fetch HuggingFace API Key
          const { data: apiKeyData, error: apiKeyFetchError } = await supabase
            .from('api_keys')
            .select('key_value')
            .eq('user_id', user.id)
            .eq('service', 'huggingface')
            .single();

          if (apiKeyFetchError && apiKeyFetchError.code !== 'PGRST116') { // PGRST116: no rows found
            console.error('Error fetching API key:', apiKeyFetchError);
            // Optionally set an error state here to display to the user
          }
          if (apiKeyData) {
            setHuggingFaceApiKey(apiKeyData.key_value);
            setInitialHuggingFaceApiKey(apiKeyData.key_value);
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
    // Regex for validation (should match the Edge Function)
    const USERNAME_REGEX = /^[a-zA-Z0-9_\-]+$/;
    const trimmedUsername = username.trim();

    // Check both format and length
    const isValidFormat = !trimmedUsername || USERNAME_REGEX.test(trimmedUsername);
    const isValidLength = !trimmedUsername || (trimmedUsername.length >= 3 && trimmedUsername.length <= 50);

    // Update the validation state
    setIsUsernameValid(isValidFormat && isValidLength);

    // Reset check state if format/length are invalid or username hasn't changed meaningfully
    if (!isValidFormat || !isValidLength || trimmedUsername === initialUsername.current) {
       setIsCheckingUsername(false);
       // Set availability true only if it's the initial username and valid
       setIsUsernameAvailable(trimmedUsername === initialUsername.current && isValidFormat && isValidLength ? true : null);
       setUsernameCheckError(null);
       // Don't proceed to debounce check if invalid or unchanged
       return;
    }

    // Only call debounce check if format/length ARE valid AND username has changed
    // This block is only reached if the username is valid format, valid length, and different from initial
    debouncedCheckUsername(trimmedUsername);

  }, [username, debouncedCheckUsername, initialUsername]);

  // Helper function to check if any fields have changed
  const hasChanges = useCallback(() => {
    if (isLoading) return false;
    const usernameChanged = username.trim() !== (initialUsername.current || '');
    const displayNameChanged = displayName.trim() !== (initialDisplayName.current || '');
    const realNameChanged = realName.trim() !== (initialRealName.current || '');
    const descriptionChanged = description.trim() !== (initialDescription.current || '');
    const linksChanged = JSON.stringify(links.map(l => l.trim()).filter(Boolean)) !== JSON.stringify((initialLinks.current || []).map(l => l.trim()).filter(Boolean));
    const avatarChanged = avatarUrl !== (initialAvatarUrl.current || '');
    const backgroundChanged = backgroundImageUrl !== (initialBackgroundImageUrl.current || '');

    return usernameChanged || displayNameChanged || realNameChanged || descriptionChanged || linksChanged || avatarChanged || backgroundChanged;
  }, [
    isLoading,
    username,
    displayName,
    realName,
    description,
    links,
    avatarUrl,
    backgroundImageUrl,
    initialUsername,
    initialDisplayName,
    initialRealName,
    initialDescription,
    initialLinks,
    initialAvatarUrl,
    initialBackgroundImageUrl
  ]);

  // Helper function to get domain from URL for favicon
  const getDomain = (url: string): string => {
    try {
      let domain = new URL(url).hostname;
      // Remove www. if present
      domain = domain.replace(/^www\./, '');
      return domain;
    } catch (e) {
      // Return the original string if it's not a valid URL
      // or handle differently if preferred
      return url;
    }
  };

  // Function to record a change
  const recordChange = useCallback(() => {
    setLastChangeTimestamp(Date.now());
  }, []);

  // Modify the effect to handle rendering state for fade-out
  useEffect(() => {
    if (lastChangeTimestamp === null) {
      // Start fade-out immediately when changes are saved/discarded
      setShowReminder(false);
      if (reminderTimeoutRef.current) {
        clearTimeout(reminderTimeoutRef.current);
        reminderTimeoutRef.current = null;
      }
      // Optionally delay removing from DOM to allow fade-out, but opacity handles visual
      // setIsReminderRendered(false); // Might remove too quickly, let opacity handle it
      return;
    }

    // A change was just recorded
    setIsReminderRendered(true); // Ensure it's rendered
    setShowReminder(true);     // Make it visible (or start fade-in)

    // Clear any existing timer
    if (reminderTimeoutRef.current) {
      clearTimeout(reminderTimeoutRef.current);
    }

    // Set a new timer to start the fade-out
    reminderTimeoutRef.current = setTimeout(() => {
      setShowReminder(false); // Start fade-out
      reminderTimeoutRef.current = null;
      // Optional: Set another shorter timer to remove from DOM after fade
      // setTimeout(() => setIsReminderRendered(false), 500); // Match transition duration
    }, 5000); // 5 seconds visible

    // Cleanup function for component unmount
    return () => {
      if (reminderTimeoutRef.current) {
        clearTimeout(reminderTimeoutRef.current);
      }
    };
  }, [lastChangeTimestamp]);

  // === ADDED: Function to handle discarding changes ===
  const handleDiscardChanges = useCallback(() => {
    // Reset state variables to initial values stored in refs
    setUsername(initialUsername.current || '');
    setDisplayName(initialDisplayName.current || '');
    setRealName(initialRealName.current || '');
    setDescription(initialDescription.current || '');
    setLinks(initialLinks.current || []);
    setAvatarUrl(initialAvatarUrl.current || '');
    setBackgroundImageUrl(initialBackgroundImageUrl.current || '');

    // Reset validation and error states
    setIsUsernameValid(true);
    setIsCheckingUsername(false);
    setIsUsernameAvailable(null);
    setUsernameCheckError(null);
    setError(null); // Clear general form errors
    setNewLink(''); // Clear the new link input
    setEditingLinkIndex(null); // Exit link editing mode
    setEditingLinkValue('');
    setLastChangeTimestamp(null); // Reset timestamp (triggers effect to hide reminder)

    // Optionally, provide user feedback
    toast({
      title: "Changes Discarded",
      description: "Your profile settings have been reset to the last saved state.",
    });
    // Also reset API key input to the last saved state if modal was open
    setHuggingFaceApiKey(initialHuggingFaceApiKey);
  }, []); // Dependencies are refs, so they don't need to be listed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Re-check validation state before submitting
    if (!isUsernameValid) {
      toast({
        title: "Validation Error",
        description: 'Username must be 3-50 characters long and contain only letters, numbers, underscores, or hyphens.',
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
        setLastChangeTimestamp(null); // Reset timestamp (triggers effect to hide reminder)
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
      recordChange(); // Record change
    } else {
      setError('Please enter a valid URL');
    }
  };

  const handleRemoveLink = (indexToRemove: number) => {
    setLinks(links.filter((_, index) => index !== indexToRemove));
    recordChange(); // Record change
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
      handleAddLink(); // This already calls recordChange
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
          recordChange(); // Record change
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
          recordChange(); // Record change
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
      recordChange(); // Record change
    } else {
      setError('Please enter a valid URL');
    }
  };

  const handleCancelEdit = () => {
    setEditingLinkIndex(null);
    setEditingLinkValue('');
  };

  const handleSaveApiKey = async () => {
    if (!user) {
      setApiKeyError("User not authenticated.");
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    // Validate against the current input state `huggingFaceApiKey`
    if (!huggingFaceApiKey.trim()) {
      setApiKeyError("API Key cannot be empty.");
      // toast({ title: "Validation Error", description: "API Key cannot be empty.", variant: "destructive" });
      return; // Return early, error displayed in modal
    }

    setIsSavingApiKey(true);
    setApiKeyError(null);

    try {
      const { error } = await supabase
        .from('api_keys')
        .upsert(
          {
            user_id: user.id,
            service: 'huggingface',
            key_value: huggingFaceApiKey.trim(), // Save the current input value
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,service',
          }
        );

      if (error) {
        throw error;
      }

      setInitialHuggingFaceApiKey(huggingFaceApiKey.trim()); // Update the initial saved key to the new value
      toast({ title: "Success", description: "HuggingFace API Key updated successfully." });
      setIsApiKeyModalOpen(false);
    } catch (err: any) {
      console.error('Error saving API key:', err);
      setApiKeyError(err.message || "Failed to save API Key.");
      // toast({ title: "Error", description: err.message || "Failed to save API Key.", variant: "destructive" });
    } finally {
      setIsSavingApiKey(false);
    }
  };

  // Use the skeleton loader when isLoading is true
  if (isLoading) {
    return <UserProfileSettingsSkeleton />;
  }

  return (
    <Card className="max-w-2xl mx-auto my-8 bg-card/80 backdrop-blur-sm border border-border/20 animate-fade-in">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Manage your public profile information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <p className="text-destructive text-sm">{error}</p>}
          
          {/* Avatar and Background Image Section */}
          <div className="space-y-4">
            {/* Background Image Upload */}
            <div>
              <Label htmlFor="background-image" className="text-sm font-medium">Background Image</Label>
              <div 
                className="mt-1 h-32 rounded-md border border-dashed border-border flex items-center justify-center relative bg-cover bg-center cursor-pointer hover:border-primary group"
                style={{ backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : 'none' }}
                onClick={handleBackgroundImageClick}
              >
                {!backgroundImageUrl && (
                  <div className="text-center text-muted-foreground group-hover:text-primary">
                    <ImageIcon className="mx-auto h-8 w-8" />
                    <p className="text-xs mt-1">Click to upload</p>
                  </div>
                )}
                {backgroundImageUrl && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>
              <input 
                type="file" 
                ref={backgroundFileInputRef} 
                onChange={handleBackgroundFileChange} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp, image/gif"
              />
              {isReminderRendered && backgroundImageUrl !== initialBackgroundImageUrl.current && <ReminderText isVisible={showReminder} />}
            </div>
            
            {/* Avatar Upload */}
            <div className="flex items-center space-x-4">
              <Avatar 
                className="h-20 w-20 border border-border cursor-pointer relative group"
                onClick={handleAvatarClick}
              >
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback>{getInitials(displayName || username)}</AvatarFallback>
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </Avatar>
              <input 
                type="file" 
                ref={avatarFileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp, image/gif"
              />
              <div>
                <Label htmlFor="avatar" className="text-sm font-medium">Avatar</Label>
                <p className="text-xs text-muted-foreground">Click avatar to upload (PNG, JPG, GIF, WEBP).</p>
                {isReminderRendered && avatarUrl !== initialAvatarUrl.current && <ReminderText isVisible={showReminder} />}
              </div>
            </div>
          </div>

          {/* Text Inputs Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Username Input */}
            <div className="space-y-2">
              <Label htmlFor="username">
                Username
                <HoverCard openDelay={0} closeDelay={0}>
                  <HoverCardTrigger asChild>
                    <HelpCircle className="inline-block h-5 w-5 ml-2 text-muted-foreground cursor-help p-1 align-middle" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 text-sm">
                    Your unique username (3-50 chars). Can contain letters, numbers, underscores (_), and hyphens (-).
                  </HoverCardContent>
                </HoverCard>
              </Label>
              <div className="relative flex items-center">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-sm opacity-50">
                  @
                </span>
                <Input 
                  id="username"
                  value={username}
                  onChange={(e) => {setUsername(e.target.value); recordChange();}}
                  className={cn(
                    "pl-7",
                    !isUsernameValid ? 'border-destructive focus-visible:ring-destructive' : '',
                    isCheckingUsername || isUsernameAvailable === null || isUsernameAvailable === false ? 'pr-10' : ''
                  )}
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="^[a-zA-Z0-9_\-]+$"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {isCheckingUsername && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!isCheckingUsername && usernameCheckError && (
                    <HoverCard openDelay={0} closeDelay={0}>
                      <HoverCardTrigger asChild>
                        <X className="h-4 w-4 text-destructive cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 text-sm text-destructive-foreground bg-destructive">
                        Error: {usernameCheckError}
                      </HoverCardContent>
                    </HoverCard>
                  )}
                  {!isCheckingUsername && !usernameCheckError && isUsernameAvailable === true && username.trim() !== initialUsername.current && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {!isCheckingUsername && !usernameCheckError && isUsernameAvailable === false && (
                    <HoverCard openDelay={0} closeDelay={0}>
                      <HoverCardTrigger asChild>
                        <X className="h-4 w-4 text-destructive cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 text-sm">
                        This username is already taken.
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </div>
              </div>
              {!isUsernameValid && (
                <p className="text-xs text-destructive">
                  Must be 3-50 chars: letters, numbers, _, - only.
                </p>
              )}
              {isReminderRendered && username.trim() !== initialUsername.current && isUsernameValid && <ReminderText isVisible={showReminder} />}
            </div>
            
            {/* Display Name Input */}
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input 
                id="display-name"
                value={displayName}
                onChange={(e) => {setDisplayName(e.target.value); recordChange();}}
                required
                className={!displayName.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {!displayName.trim() && <p className="text-xs text-destructive">Display name is required.</p>}
              {isReminderRendered && displayName.trim() !== initialDisplayName.current && displayName.trim() && <ReminderText isVisible={showReminder} />}
            </div>
          
            {/* Real Name Input - Moved inside grid */}
            <div className="space-y-2">
              <Label htmlFor="real-name">Real Name (Optional)</Label>
              <Input 
                id="real-name"
                value={realName}
                onChange={(e) => {setRealName(e.target.value); recordChange();}}
              />
              {isReminderRendered && realName.trim() !== initialRealName.current && <ReminderText isVisible={showReminder} />}
            </div>

            {/* Discord Username (Read-only) - Moved inside grid */}
            <div className="space-y-2">
              <Label htmlFor="discord-username">
                Discord Username
                <HoverCard openDelay={0} closeDelay={0}>
                  <HoverCardTrigger asChild>
                    <HelpCircle className="inline-block h-5 w-5 ml-2 text-muted-foreground cursor-help p-1 align-middle" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 text-sm">
                    This is synced from your Discord account. To change it, please update your username on Discord.
                  </HoverCardContent>
                </HoverCard>
              </Label>
              <Input
                id="discord-username"
                value={profile?.discord_username || 'N/A'} // Display fetched profile data
                readOnly
                disabled
                className="cursor-not-allowed opacity-70" // Add styling for disabled look
              />
            </div>

            {/* Description Textarea - Moved inside grid and spanning columns */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Bio / Description (Optional)</Label>
              <Textarea 
                id="description"
                value={description}
                onChange={(e) => {setDescription(e.target.value); recordChange();}}
                placeholder="Tell us a little about yourself..."
                className="min-h-[80px]"
                maxLength={500}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {description.length} / 500
                </p>
                {isReminderRendered && description.trim() !== initialDescription.current && <ReminderText isVisible={showReminder} />}
              </div>
            </div>
          </div> {/* End of the main text input grid */}

          {/* Links Section */}
          <div className="space-y-4">
            <Label>Links (Optional)</Label>
            {links.map((link, index) => (
              <div key={index} className="flex items-center space-x-2">
                {editingLinkIndex === index ? (
                  <Input
                    type="text"
                    value={editingLinkValue}
                    onChange={(e) => setEditingLinkValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEditedLink(index);
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    className="flex-grow min-w-0"
                    placeholder="https://example.com"
                    autoFocus
                  />
                ) : (
                  <div className="flex-grow flex items-center space-x-2 p-2 border rounded-md bg-background overflow-hidden min-w-0">
                     <img 
                        src={`https://www.google.com/s2/favicons?domain=${getDomain(link)}&sz=16`}
                        alt="" 
                        className="w-4 h-4 flex-shrink-0"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                     <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm truncate hover:underline flex-grow min-w-0">
                        {link}
                     </a>
                  </div>
                )}

                {editingLinkIndex === index ? (
                   <>
                      <Button type="button" size="icon" variant="ghost" onClick={() => handleSaveEditedLink(index)} disabled={!isValidUrl(editingLinkValue)} className="h-8 w-8 flex-shrink-0">
                          <Check className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8 flex-shrink-0">
                          <X className="h-4 w-4" />
                      </Button>
                   </>
                 ) : (
                  <Button type="button" size="icon" variant="ghost" onClick={() => handleEditLink(index)} className="h-8 w-8 flex-shrink-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                 )}
                <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveLink(index)} className="h-8 w-8 flex-shrink-0">
                  <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" />
                </Button>
              </div>
            ))}
            {isReminderRendered && JSON.stringify(links.map(l => l.trim()).filter(Boolean)) !== JSON.stringify((initialLinks.current || []).map(l => l.trim()).filter(Boolean)) && <ReminderText isVisible={showReminder} />}
            {editingLinkIndex === null && links.length < 5 && (
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a link (e.g., https://portfolio.com)"
                  className="flex-grow"
                />
                <Button type="button" size="icon" variant="ghost" onClick={handleAddLink} disabled={!isValidUrl(newLink) || links.length >= 5} className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {links.length >= 5 && editingLinkIndex === null && <p className="text-xs text-muted-foreground">Maximum of 5 links reached.</p>}
          </div>

          {/* API Keys Section */}
          <div className="space-y-2 pt-6 border-t border-border/20">
            <h3 className="text-lg font-medium">API Keys</h3>
            <Card className="bg-background/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="hf-api-key-current" className="text-sm font-medium">HuggingFace API Key</Label>
                    <p className="text-xs text-muted-foreground">
                      {initialHuggingFaceApiKey ? 'Key is set. Click manage to update it.' : 'No key set. Click manage to add your key.'}
                    </p>
                  </div>
                  <Dialog open={isApiKeyModalOpen} onOpenChange={(isOpen) => {
                     setIsApiKeyModalOpen(isOpen);
                     if (!isOpen) { // When modal is closed
                        setHuggingFaceApiKey(initialHuggingFaceApiKey); // Reset input to last saved value
                        setApiKeyError(null); // Clear any modal-specific errors
                     }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="mr-2 h-4 w-4" /> Manage Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px]">
                      <DialogHeader>
                        <DialogTitle>HuggingFace API Key</DialogTitle>
                        <DialogDescription>
                          Enter your HuggingFace API Key with write permissions to upload models directly from OpenMuse. 
                          You can create or find your keys at{" "}
                          <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">
                            huggingface.co/settings/tokens <ExternalLink className="inline-block h-3 w-3 ml-0.5" />
                          </a>.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="hf-api-key-input" className="text-right col-span-1">
                            API Key
                          </Label>
                          <Input
                            id="hf-api-key-input"
                            type="password"
                            value={huggingFaceApiKey} // Bound to the current input state
                            onChange={(e) => {
                              setHuggingFaceApiKey(e.target.value);
                              if (apiKeyError) setApiKeyError(null); // Clear error on input change
                            }}
                            placeholder="hf_YourAccessToken"
                            className="col-span-3"
                          />
                        </div>
                        {apiKeyError && <p className="text-xs text-destructive col-span-4 text-center pt-1">{apiKeyError}</p>}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsApiKeyModalOpen(false)} disabled={isSavingApiKey}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveApiKey} disabled={isSavingApiKey || huggingFaceApiKey.trim() === initialHuggingFaceApiKey.trim() || !huggingFaceApiKey.trim()}>
                          {isSavingApiKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Save API Key
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>

        </CardContent>
        <CardFooter className="border-t pt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-2">
          <Button 
             type="button" 
             variant="outline"
             onClick={() => window.open(`/profile/${profile?.username}?loggedOutView=true`, '_blank')}
             disabled={!profile?.username}
             className="w-full sm:w-auto"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
             View Public Profile
          </Button>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
             <Button 
                type="button"
                variant="outline"
                onClick={handleDiscardChanges}
                disabled={!hasChanges()}
                className="flex-grow sm:flex-grow-0"
             >
               Discard Changes
             </Button>
             <Button 
               type="submit" 
               disabled={isLoading || isSaving || !isUsernameValid || isUsernameAvailable === false || (isUsernameAvailable === null && username !== initialUsername.current) || !displayName.trim() || !hasChanges()}
               className="flex-grow sm:flex-grow-0"
              >
               {isSaving ? (
                 <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
               ) : justSaved ? (
                  <><Check className="mr-2 h-4 w-4" /> Saved!</>
               ) : (
                 'Save Changes'
               )}
             </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
