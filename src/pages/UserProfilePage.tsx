import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, UserProfile, VideoEntry } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import LoraCard from '@/components/lora/LoraCard';
import { LoraGallerySkeleton } from '@/components/LoraGallerySkeleton';
import UploadModal from '@/components/upload/UploadModal';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import VideoCard from '@/components/video/VideoCard';
import VideoPaginatedGrid from '@/components/video/VideoPaginatedGrid';

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
  const [userVideos, setUserVideos] = useState<VideoEntry[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [lightboxVideo, setLightboxVideo] = useState<VideoEntry | null>(null);
  const [generationVideos, setGenerationVideos] = useState<VideoEntry[]>([]);
  const [artVideos, setArtVideos] = useState<VideoEntry[]>([]);

  useEffect(() => {
    setForceLoggedOutView(searchParams.get('loggedOutView') === 'true');
  }, [searchParams]);

  useEffect(() => {
    const fetchProfileByDisplayName = async () => {
      if (!displayName) return;
      
      setIsLoading(true);
      
      try {
        const decodedDisplayName = decodeURIComponent(displayName);
        
        let { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('display_name', decodedDisplayName)
          .maybeSingle();
        
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
            fetchUserVideos(data.id);
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
        const processedAssets: LoraAsset[] = assetsData.map(asset => {
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
        
        setUserAssets(processedAssets);
      }
    } catch (err) {
      console.error('Error processing user assets:', err);
    } finally {
      setIsLoadingAssets(false);
    }
  };

const fetchUserVideos = async (userId: string) => {
  setIsLoadingVideos(true);
  try {
    const { data: videosData, error: videosError } = await supabase
      .from('media')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'video')
      .order('created_at', { ascending: false });
    
    if (videosError) {
      console.error('Error fetching user videos:', videosError);
      return;
    }

    if (videosData) {
      console.log('Raw videos data:', videosData.map(video => ({
        id: video.id,
        classification: video.classification,
        title: video.title
      })));

      const processedVideos: VideoEntry[] = videosData.map(video => {
        let classification = video.classification || 'generation';
        if (classification !== 'art' && classification !== 'generation') {
          console.log(`Defaulting video ${video.id} classification from '${video.classification}' to 'generation'`);
          classification = 'generation';
        }
        
        const processedVideo: VideoEntry = {
          id: video.id,
          video_location: video.url,
          reviewer_name: video.creator || '',
          skipped: false,
          created_at: video.created_at,
          admin_approved: video.admin_approved,
          user_id: video.user_id,
          metadata: {
            title: video.title,
            description: '',
            creator: 'self',
            classification: classification,
            thumbnailUrl: video.metadata?.thumbnailUrl
          }
        };
        
        return processedVideo;
      });
      
      const generations = processedVideos.filter(v => {
        const isGeneration = v.metadata?.classification === 'generation';
        console.log(`Video ${v.id} (${v.metadata?.title || 'Untitled'}): ${isGeneration ? 'Generation ✅' : 'Not Generation ❌'}`);
        return isGeneration;
      });

      const art = processedVideos.filter(v => {
        const isArt = v.metadata?.classification === 'art';
        console.log(`Video ${v.id} (${v.metadata?.title || 'Untitled'}): ${isArt ? 'Art ✅' : 'Not Art ❌'}`);
        return isArt;
      });
      
      console.log('Generation Videos:', generations.map(v => v.id));
      console.log('Art Videos:', art.map(v => v.id));
      
      setGenerationVideos(generations);
      setArtVideos(art);
      setUserVideos(processedVideos);
    }
  } catch (err) {
    console.error('Error processing user videos:', err);
  } finally {
    setIsLoadingVideos(false);
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

  const handleOpenLightbox = (video: VideoEntry) => {
    setLightboxVideo(video);
  };

  const handleCloseLightbox = () => {
    setLightboxVideo(null);
  };

  const deleteVideo = async (id: string) => {
    try {
      await supabase
        .from('media')
        .delete()
        .eq('id', id);
      
      setGenerationVideos(prev => prev.filter(video => video.id !== id));
      setArtVideos(prev => prev.filter(video => video.id !== id));
      setUserVideos(prev => prev.filter(video => video.id !== id));
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const approveVideo = async (id: string) => {
    try {
      await supabase
        .from('media')
        .update({ admin_approved: 'Curated' })
        .eq('id', id);
      
      setGenerationVideos(prev => prev.map(video =>
        video.id === id ? { ...video, admin_approved: 'Curated' } : video
      ));
      setArtVideos(prev => prev.map(video =>
        video.id === id ? { ...video, admin_approved: 'Curated' } : video
      ));
      setUserVideos(prev => prev.map(video =>
        video.id === id ? { ...video, admin_approved: 'Curated' } : video
      ));
    } catch (error) {
      console.error('Error approving video:', error);
    }
  };

  const rejectVideo = async (id: string) => {
    try {
      await supabase
        .from('media')
        .update({ admin_approved: 'Rejected' })
        .eq('id', id);
      
      setGenerationVideos(prev => prev.map(video =>
        video.id === id ? { ...video, admin_approved: 'Rejected' } : video
      ));
      setArtVideos(prev => prev.map(video =>
        video.id === id ? { ...video, admin_approved: 'Rejected' } : video
      ));
      setUserVideos(prev => prev.map(video =>
        video.id === id ? { ...video, admin_approved: 'Rejected' } : video
      ));
    } catch (error) {
      console.error('Error rejecting video:', error);
    }
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
              {isOwner && !forceLoggedOutView ? (
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
                <CardTitle>LoRAs</CardTitle>
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
                  <LoraGallerySkeleton count={isMobile ? 2 : 6} />
                ) : userAssets.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    This user hasn't created any LoRAs yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Generations</CardTitle>
                {isOwner && profile?.id && !forceLoggedOutView && (
                  <UploadModal
                    trigger={
                      <Button>
                        Add new Generation
                      </Button>
                    }
                    initialUploadType="video"
                    onUploadSuccess={() => fetchUserVideos(profile.id)}
                  />
                )}
              </CardHeader>
              <CardContent>
                {isLoadingVideos ? (
                  <LoraGallerySkeleton count={isMobile ? 2 : 6} />
                ) : (
                  <VideoPaginatedGrid
                    videos={generationVideos}
                    itemsPerPage={18} // 3 rows × 6 columns
                    gridCols="grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                    isAdmin={isAdmin}
                    onOpenLightbox={handleOpenLightbox}
                    onDelete={deleteVideo}
                    onApprove={approveVideo}
                    onReject={rejectVideo}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="mt-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Art</CardTitle>
                {isOwner && profile?.id && !forceLoggedOutView && (
                  <UploadModal
                    trigger={
                      <Button>
                        Add new Art
                      </Button>
                    }
                    initialUploadType="video"
                    onUploadSuccess={() => fetchUserVideos(profile.id)}
                  />
                )}
              </CardHeader>
              <CardContent>
                {isLoadingVideos ? (
                  <LoraGallerySkeleton count={isMobile ? 2 : 4} />
                ) : (
                  <VideoPaginatedGrid
                    videos={artVideos}
                    itemsPerPage={6} // 3 rows × 2 columns
                    gridCols="grid-cols-1 sm:grid-cols-2"
                    isAdmin={isAdmin}
                    onOpenLightbox={handleOpenLightbox}
                    onDelete={deleteVideo}
                    onApprove={approveVideo}
                    onReject={rejectVideo}
                  />
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
