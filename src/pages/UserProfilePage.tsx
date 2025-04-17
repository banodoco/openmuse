
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import LoraList from '@/components/lora/LoraList';

export default function UserProfilePage() {
  const { displayName } = useParams<{ displayName: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [userAssets, setUserAssets] = useState<LoraAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

  useEffect(() => {
    const fetchProfileByDisplayName = async () => {
      if (!displayName) return;
      
      setIsLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('display_name', displayName)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }
        
        if (data) {
          setProfile(data as UserProfile);
          const ownerStatus = user?.id === data.id;
          setIsOwner(ownerStatus);
          setCanEdit(ownerStatus || !!isAdmin);
          
          // Once we have the profile, fetch the user's assets
          if (data.id) {
            fetchUserAssets(data.id);
          }
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfileByDisplayName();
  }, [displayName, user, navigate, isAdmin]);

  const fetchUserAssets = async (userId: string) => {
    setIsLoadingAssets(true);
    try {
      // Fetch user's LoRA assets
      const { data: assetsData, error: assetsError } = await supabase
        .from('assets')
        .select('*, primaryVideo:primary_media_id(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (assetsError) {
        console.error('Error fetching user assets:', assetsError);
        return;
      }

      if (assetsData) {
        // Process the data to match LoraAsset structure
        const processedAssets: LoraAsset[] = assetsData.map(asset => ({
          id: asset.id,
          name: asset.name,
          description: asset.description,
          creator: asset.creator,
          type: asset.type,
          created_at: asset.created_at,
          user_id: asset.user_id,
          primary_media_id: asset.primary_media_id,
          admin_approved: asset.admin_approved,
          lora_type: asset.lora_type,
          lora_base_model: asset.lora_base_model,
          model_variant: asset.model_variant,
          lora_link: asset.lora_link,
          primaryVideo: asset.primaryVideo ? {
            id: asset.primaryVideo.id,
            video_location: asset.primaryVideo.url,
            reviewer_name: asset.primaryVideo.creator || '',
            skipped: false,
            created_at: asset.primaryVideo.created_at,
            admin_approved: asset.primaryVideo.admin_approved,
            user_id: asset.primaryVideo.user_id,
            metadata: {
              title: asset.primaryVideo.title,
              thumbnailUrl: asset.primaryVideo.url
            }
          } : undefined
        }));
        
        setUserAssets(processedAssets);
      }
    } catch (err) {
      console.error('Error processing user assets:', err);
    } finally {
      setIsLoadingAssets(false);
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

  const handleAddLoraClick = () => {
    navigate('/upload');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
        <PageHeader
          title={profile ? `${profile.display_name}'s Profile` : 'Profile'}
          description={canEdit ? "Manage your profile information" : "View user profile"}
        />
        
        {isLoading ? (
          <Card className="w-full max-w-2xl mx-auto">
            <CardContent className="py-8">
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="max-w-2xl mx-auto">
              {canEdit ? (
                <UserProfileSettings />
              ) : (
                <Card className="w-full">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center space-y-4">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={profile?.avatar_url || ''} alt={profile?.display_name || ''} />
                        <AvatarFallback>{profile ? getInitials(profile.display_name || profile.username) : '??'}</AvatarFallback>
                      </Avatar>
                      
                      <div className="text-center">
                        <h2 className="text-2xl font-bold">{profile?.display_name}</h2>
                        <p className="text-muted-foreground">{profile?.username}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* User Assets Section */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Assets</h2>
                {isOwner && (
                  <Button onClick={handleAddLoraClick} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add LoRA
                  </Button>
                )}
              </div>

              {isLoadingAssets ? (
                <Card className="w-full">
                  <CardContent className="py-8">
                    <div className="flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <LoraList loras={userAssets} />
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
