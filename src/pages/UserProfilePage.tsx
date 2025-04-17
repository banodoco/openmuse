import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import LoraCard from '@/components/lora/LoraCard';
import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
import UploadModal from '@/components/upload/UploadModal';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export default function UserProfilePage() {
  const { displayName } = useParams<{ displayName: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [userAssets, setUserAssets] = useState<LoraAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [forceLoggedOutView, setForceLoggedOutView] = useState(false);

  useEffect(() => {
    setForceLoggedOutView(searchParams.get('loggedOutView') === 'true');
  }, [searchParams]);

  useEffect(() => {
    const fetchProfileByDisplayName = async () => {
      if (!displayName) return;
      
      setIsLoading(true);
      
      try {
        // Decode the URL-encoded displayName
        const decodedDisplayName = decodeURIComponent(displayName);
        
        // First try to find by display_name
        let { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('display_name', decodedDisplayName)
          .maybeSingle();
        
        // If not found by display_name, try username (Discord username)
        if (!data && !error) {
          const { data: usernameData, error: usernameError } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', decodedDisplayName)
            .maybeSingle();
            
          if (usernameError) {
            console.error('Error fetching profile by username:', usernameError);
          } else {
            data = usernameData;
          }
        } else if (error) {
          console.error('Error fetching profile by display name:', error);
          return;
        }
        
        if (data) {
          setProfile(data as UserProfile);
          const ownerStatus = user?.id === data.id;
          setIsOwner(ownerStatus);
          setCanEdit(ownerStatus || !!isAdmin);
          
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
        console.log('Assets data:', assetsData);
        
        const processedAssets: LoraAsset[] = assetsData.map(asset => {
          console.log('Processing asset:', asset.id, 'Primary video:', asset.primaryVideo);
          
          const videoUrl = asset.primaryVideo?.url || '';
          const thumbnailUrl = asset.primaryVideo?.metadata?.thumbnailUrl || null;
          
          return {
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
                thumbnailUrl: thumbnailUrl
              }
            } : undefined
          };
        });
        
        console.log('Processed assets:', processedAssets);
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

  const renderProfileLinks = () => {
    if (!profile?.links || profile.links.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {profile.links.map((link, index) => {
          try {
            const url = new URL(link);
            const domain = url.hostname;
            
            return (
              <HoverCard key={index}>
                <HoverCardTrigger asChild>
                  <a 
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex items-center justify-center w-10 h-10 bg-muted/30 hover:bg-muted/50 rounded-full transition-colors"
                  >
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                      alt=""
                      className="w-5 h-5"
                    />
                  </a>
                </HoverCardTrigger>
                <HoverCardContent className="p-2 text-sm">
                  {domain}
                </HoverCardContent>
              </HoverCard>
            );
          } catch (e) {
            return null; // Skip invalid URLs
          }
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-8">
        <PageHeader
          title=""
          description=""
        />
        
        {!isLoading && (
          <>
            <div className="max-w-2xl mx-auto">
              {canEdit && !forceLoggedOutView ? (
                <UserProfileSettings />
              ) : (
                <Card className="w-full">
                  {profile?.background_image_url && (
                    <div 
                      className="w-full h-48 bg-cover bg-center rounded-t-lg" 
                      style={{ backgroundImage: `url(${profile.background_image_url})` }}
                    />
                  )}
                  <CardContent className={`pt-6 pb-4 ${profile?.background_image_url ? '-mt-16 relative z-10' : ''}`}>
                    <div className="flex flex-col items-center space-y-4">
                      <Avatar className={`h-24 w-24 border-4 border-white shadow-lg ${profile?.background_image_url ? '-mt-13' : ''}`}>
                        <AvatarImage src={profile?.avatar_url || ''} alt={profile?.display_name || ''} />
                        <AvatarFallback>{profile ? getInitials(profile.display_name || profile.username) : '??'}</AvatarFallback>
                      </Avatar>
                      
                      <div className="text-center">
                        <h2 className="text-2xl font-bold">{profile?.display_name}</h2>
                        
                        {profile?.real_name && (
                          <p className="text-muted-foreground mt-1">{profile.real_name}</p>
                        )}
                        
                        <p className="text-muted-foreground text-sm">{profile?.username}</p>
                        
                        {profile?.description && (
                          <div className="mt-4 max-w-md mx-auto">
                            <p className="text-sm text-foreground/90">{profile.description}</p>
                          </div>
                        )}
                        
                        {renderProfileLinks()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="mt-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Assets</CardTitle>
                {isOwner && profile?.id && !forceLoggedOutView && (
                  <UploadModal
                    trigger={
                      <Button> 
                        Add new LoRA
                      </Button>
                    }
                    initialUploadType="lora"
                    onUploadSuccess={() => fetchUserAssets(profile.id)}
                  />
                )}
              </CardHeader>
              <CardContent>
                {isLoadingAssets ? (
                  <LoraGallerySkeleton count={isMobile ? 2 : 4} />
                ) : userAssets.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {userAssets.map(asset => (
                      <LoraCard 
                        key={asset.id} 
                        lora={asset}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    This user hasn't created any assets yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
