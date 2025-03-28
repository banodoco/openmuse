import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, debugAssetMedia } from '@/integrations/supabase/client';
import Navigation, { Footer } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, X, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoraAsset, VideoEntry } from '@/lib/types';
import { toast } from 'sonner';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { videoUrlService } from '@/lib/services/videoUrlService';
import { checkIsAdmin } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import LoRAVideoUploader from '@/components/lora/LoRAVideoUploader';
import VideoLightbox from '@/components/VideoLightbox';
import { useVideoHover } from '@/hooks/useVideoHover';
import StorageVideoPlayer from '@/components/StorageVideoPlayer';

const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<LoraAsset | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  const [dataFetchAttempted, setDataFetchAttempted] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoEntry | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        if (user?.id) {
          console.log('AssetDetailPage - Checking admin status for user:', user.id);
          const adminStatus = await checkIsAdmin(user.id);
          console.log('AssetDetailPage - Admin status result:', adminStatus);
          setIsAdmin(adminStatus);
        } else {
          console.log('AssetDetailPage - No user, setting isAdmin to false');
          setIsAdmin(false);
        }
        setAuthChecked(true);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setAuthChecked(true);
      }
    };
    
    checkAdminStatus();
  }, [user]);

  const fetchAssetDetails = useCallback(async () => {
    if (!id) {
      toast.error('No asset ID provided');
      setIsLoading(false);
      setDataFetchAttempted(true);
      return;
    }

    try {
      console.log('AssetDetailPage - Fetching asset details for ID:', id);
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (assetError) {
        console.error('AssetDetailPage - Error fetching asset:', assetError);
        throw assetError;
      }

      if (!assetData) {
        console.error('AssetDetailPage - No asset found with ID:', id);
        setIsLoading(false);
        setDataFetchAttempted(true);
        return;
      }

      console.log('AssetDetailPage - Asset data retrieved:', assetData);

      const assetMediaRelationships = await debugAssetMedia(id);
      console.log('AssetDetailPage - Asset media relationships:', assetMediaRelationships);

      let assetVideos: any[] = [];
      
      if (assetMediaRelationships && assetMediaRelationships.length > 0) {
        const mediaIds = assetMediaRelationships.map(rel => rel.media_id);
        console.log('AssetDetailPage - Fetching media with IDs:', mediaIds);
        
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .in('id', mediaIds);
          
        if (mediaError) {
          console.error('AssetDetailPage - Error fetching related media:', mediaError);
        } else {
          assetVideos = mediaData || [];
          console.log('AssetDetailPage - Related media fetched:', assetVideos.length);
        }
      } else {
        const { data: videoData, error: videoError } = await supabase
          .from('media')
          .select('*')
          .eq('type', 'video');

        if (videoError) {
          console.error('AssetDetailPage - Error fetching videos:', videoError);
          throw videoError;
        }

        console.log('AssetDetailPage - All videos retrieved:', videoData?.length || 0);

        assetVideos = videoData?.filter(video => 
          video.title?.includes(assetData.name) || 
          video.id === assetData.primary_media_id
        ) || [];
        
        console.log('AssetDetailPage - Videos for this asset (filtered by name):', assetVideos?.length || 0);
      }

      const convertedVideos: VideoEntry[] = await Promise.all(
        assetVideos.map(async (media: any) => {
          try {
            const videoUrl = await videoUrlService.getVideoUrl(media.url);
            
            return {
              id: media.id,
              video_location: videoUrl,
              reviewer_name: media.creator || 'Unknown',
              skipped: false,
              created_at: media.created_at,
              admin_approved: media.admin_approved || 'Listed',
              user_id: media.user_id,
              metadata: {
                title: media.title,
                description: '',
                classification: media.classification,
                model: media.type,
                loraName: assetData.name,
                loraDescription: assetData.description,
                assetId: assetData.id
              }
            };
          } catch (error) {
            console.error(`Error processing video ${media.id}:`, error);
            return null;
          }
        })
      );

      setAsset(assetData);
      setVideos(convertedVideos.filter(v => v !== null) as VideoEntry[]);
      console.log('AssetDetailPage - Final processed videos:', convertedVideos.filter(v => v !== null).length);
    } catch (error) {
      console.error('Error fetching asset details:', error);
      toast.error('Failed to load asset details');
    } finally {
      setIsLoading(false);
      setDataFetchAttempted(true);
    }
  }, [id]);

  useEffect(() => {
    if (!dataFetchAttempted) {
      fetchAssetDetails();
    }
  }, [fetchAssetDetails, dataFetchAttempted]);

  const handleRetry = () => {
    setIsLoading(true);
    setDataFetchAttempted(false);
  };

  const handleGoBack = () => {
    navigate('/');
  };

  const handleOpenLightbox = (video: VideoEntry) => {
    setSelectedVideo(video);
    setIsLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
  };

  const getApprovalStatusBadge = () => {
    if (!asset) return null;
    
    switch (asset.admin_approved) {
      case 'Curated':
        return <Badge className="bg-green-500">Curated</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      case 'Listed':
      default:
        return <Badge variant="outline">Listed</Badge>;
    }
  };

  const handleCurateAsset = async () => {
    if (!id || !isAdmin) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Curated' })
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('LoRA curated successfully');
      setAsset(prev => prev ? { ...prev, admin_approved: 'Curated' } : null);
    } catch (error) {
      console.error('Error curating LoRA:', error);
      toast.error('Failed to curate LoRA');
    } finally {
      setIsApproving(false);
    }
  };

  const handleListAsset = async () => {
    if (!id || !isAdmin) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Listed' })
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('LoRA listed successfully');
      setAsset(prev => prev ? { ...prev, admin_approved: 'Listed' } : null);
    } catch (error) {
      console.error('Error listing LoRA:', error);
      toast.error('Failed to list LoRA');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectAsset = async () => {
    if (!id || !isAdmin) return;
    
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ admin_approved: 'Rejected' })
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('LoRA rejected');
      setAsset(prev => prev ? { ...prev, admin_approved: 'Rejected' } : null);
    } catch (error) {
      console.error('Error rejecting LoRA:', error);
      toast.error('Failed to reject LoRA');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video deleted successfully');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    }
  };

  const handleApproveVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_approved: 'Curated' })
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video curated successfully');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error curating video:', error);
      toast.error('Failed to curate video');
    }
  };

  const handleListVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_approved: 'Listed' })
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video listed successfully');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error listing video:', error);
      toast.error('Failed to list video');
    }
  };

  const handleRejectVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .update({ admin_approved: 'Rejected' })
        .eq('id', videoId);
      
      if (error) throw error;
      
      toast.success('Video rejected');
      fetchAssetDetails();
    } catch (error) {
      console.error('Error rejecting video:', error);
      toast.error('Failed to reject video');
    }
  };

  const showUploadButton = Boolean(user) && Boolean(asset);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <div className="mb-4 flex items-center">
            <Button 
              variant="outline" 
              onClick={handleGoBack}
              className="mr-4 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Loading LoRA Details...</h1>
          </div>
          <LoadingState />
        </main>
        <Footer />
      </div>
    );
  }

  if (!asset && dataFetchAttempted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <EmptyState 
            title="LoRA not found"
            description="The requested LoRA could not be found."
          />
          <div className="flex justify-center gap-4 mt-6">
            <Button onClick={handleGoBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
            <Button onClick={handleRetry} variant="outline">
              Retry Loading
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container max-w-6xl py-8 px-4">
        <div className="mb-6 flex items-center">
          <Button 
            variant="outline" 
            onClick={handleGoBack}
            className="mr-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">{asset?.name}</h1>
          <div className="ml-3">{getApprovalStatusBadge()}</div>
        </div>
        
        {process.env.NODE_ENV !== 'production' && (
          <div className="mb-4 p-2 bg-gray-100 text-xs rounded">
            <details>
              <summary className="cursor-pointer font-medium">Debug Info</summary>
              <div className="mt-2">
                <div>User: {user ? `${user.email} (${user.id})` : 'Not logged in'}</div>
                <div>Auth checked: {authChecked ? 'Yes' : 'No'}</div>
                <div>Is admin: {isAdmin ? 'Yes' : 'No'}</div>
                <div>Asset ID: {id}</div>
                <div>Videos count: {videos.length}</div>
                <div>Show upload button: {showUploadButton ? 'Yes' : 'No'}</div>
                <div>Asset name: {asset?.name || 'Not loaded'}</div>
              </div>
            </details>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>{asset?.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {asset?.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                  <p>{asset.description}</p>
                </div>
              )}
              
              {asset?.creator && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Creator</h3>
                  <p>{asset.creator}</p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Type</h3>
                <Badge variant="outline">{asset?.type}</Badge>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
                <p>{asset?.created_at ? new Date(asset.created_at).toLocaleDateString() : 'Unknown'}</p>
              </div>
            </CardContent>
            {isAdmin && authChecked && (
              <CardFooter className="flex-col items-stretch space-y-2">
                <div className="text-sm font-medium text-muted-foreground mb-2">Admin Actions</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="default" 
                    className="flex-1 gap-1"
                    onClick={handleCurateAsset}
                    disabled={isApproving || asset?.admin_approved === 'Curated'}
                  >
                    <Check className="h-4 w-4" />
                    Curate
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-1"
                    onClick={handleListAsset}
                    disabled={isApproving || asset?.admin_approved === 'Listed'}
                  >
                    List
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    className="flex-1 gap-1"
                    onClick={handleRejectAsset}
                    disabled={isApproving || asset?.admin_approved === 'Rejected'}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
          
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Videos made with this:</h2>
            </div>
            
            {showUploadButton && (
              <div className="mb-4">
                <LoRAVideoUploader 
                  assetId={asset?.id || ''} 
                  assetName={asset?.name || ''} 
                  onUploadsComplete={fetchAssetDetails} 
                />
              </div>
            )}
            
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map(video => (
                  <div 
                    key={video.id} 
                    className="relative rounded-lg overflow-hidden shadow-md group"
                    onMouseEnter={() => setHoveredVideoId(video.id)}
                    onMouseLeave={() => setHoveredVideoId(null)}
                    onClick={() => handleOpenLightbox(video)}
                  >
                    <div className="aspect-video">
                      <div className="w-full h-full">
                        <div className="w-full h-full relative">
                          <StorageVideoPlayer
                            videoLocation={video.video_location}
                            controls={false}
                            muted={true}
                            className="w-full h-full object-cover"
                            playOnHover={true}
                            previewMode={true}
                            showPlayButtonOnHover={false}
                            autoPlay={hoveredVideoId === video.id}
                            isHoveringExternally={hoveredVideoId === video.id}
                          />
                          
                          <div 
                            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 
                              ${hoveredVideoId === video.id 
                                ? 'opacity-100' 
                                : 'opacity-0'
                              }`}
                          >
                            <div className="bg-white/20 rounded-full p-2 backdrop-blur-sm">
                              <Play className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2 bg-card">
                      <h3 className="font-medium text-sm truncate">
                        {video.metadata?.title || `Video by ${video.reviewer_name}`}
                      </h3>
                      {video.reviewer_name && (
                        <p className="text-xs text-muted-foreground">By {video.reviewer_name}</p>
                      )}
                    </div>
                    
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex space-x-1 z-10">
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-6 w-6 bg-black/40 hover:bg-black/60 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproveVideo(video.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="h-6 w-6 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVideo(video.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState 
                title="No Videos"
                description="No videos are currently associated with this LoRA."
              />
            )}
          </div>
        </div>
      </main>
      
      <Footer />
      
      {selectedVideo && (
        <VideoLightbox
          isOpen={isLightboxOpen}
          onClose={handleCloseLightbox}
          videoUrl={selectedVideo.video_location}
          title={selectedVideo.metadata?.title || `Video by ${selectedVideo.reviewer_name}`}
          creator={selectedVideo.reviewer_name}
        />
      )}
    </div>
  );
};

export default AssetDetailPage;
