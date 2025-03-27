
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import VideoPlayer from '@/components/video/VideoPlayer';
import { ArrowLeft, Check, X, Filter } from 'lucide-react';
import { toast } from 'sonner';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from "@/components/ui/popover";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const VideoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<{approved: boolean, notApproved: boolean}>({
    approved: true,
    notApproved: true
  });
  const [relatedVideos, setRelatedVideos] = useState<VideoEntry[]>([]);

  useEffect(() => {
    const loadVideo = async () => {
      if (!id) {
        setError("No video ID provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Use databaseSwitcher to get the correct database instance
        const db = await databaseSwitcher.getDatabase();
        const entries = await db.getAllEntries();
        const foundVideo = entries.find(entry => entry.id === id);
        
        if (foundVideo) {
          console.log('Found video:', foundVideo);
          setVideo(foundVideo);
          
          // Find related assets
          if (foundVideo.metadata?.assetId) {
            const assetId = foundVideo.metadata.assetId;
            // Get all videos with the same assetId
            const related = entries.filter(entry => 
              entry.id !== id && 
              entry.metadata?.assetId === assetId
            );
            setRelatedVideos(related);
          }
        } else {
          console.error('Video not found with ID:', id);
          setError("Video not found");
        }
      } catch (err) {
        console.error("Error loading video:", err);
        setError("Failed to load video");
        toast.error("Could not load the requested video");
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [id]);

  const handleVideoLoaded = () => {
    console.log("Video loaded successfully");
  };

  const handleGoBack = () => {
    navigate('/');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const filteredRelatedVideos = relatedVideos.filter(video => {
    if (assetFilter.approved && video.admin_approved === true) return true;
    if (assetFilter.notApproved && (video.admin_approved === false || video.admin_approved === null)) return true;
    return false;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <LoadingState />
        </main>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-6xl py-8 px-4">
          <EmptyState 
            title="Video not found"
            description={error || "The requested video could not be found."}
          />
          <div className="flex justify-center mt-6">
            <Button onClick={handleGoBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold">Video Details</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{video.metadata?.title || video.reviewer_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full bg-muted rounded-md overflow-hidden">
                  <VideoPlayer 
                    src={video.video_location} 
                    controls
                    onLoadedData={handleVideoLoaded}
                    muted={false}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Video Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Approval Status</h3>
                  <div className="mt-1">
                    {video.admin_approved === true ? (
                      <Badge variant="success" className="gap-1">
                        <Check className="h-3 w-3" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <X className="h-3 w-3" />
                        Not Approved
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Creator</h3>
                  <p>{video.metadata?.creatorName || video.reviewer_name}</p>
                </div>
                
                {video.metadata?.description && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                    <p>{video.metadata.description}</p>
                  </div>
                )}
                
                {video.metadata?.classification && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Classification</h3>
                    <p className="capitalize">{video.metadata.classification}</p>
                  </div>
                )}
                
                {video.metadata?.model && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Model</h3>
                    <p className="uppercase">{video.metadata.model}</p>
                  </div>
                )}
                
                {video.metadata?.loraName && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">LoRA Name</h3>
                    <p>{video.metadata.loraName}</p>
                  </div>
                )}
                
                {video.metadata?.loraDescription && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">LoRA Description</h3>
                    <p>{video.metadata.loraDescription}</p>
                  </div>
                )}
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
                  <p>{formatDate(video.created_at)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {video.metadata?.assetId && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Related Assets</h2>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filter
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-4">
                  <h3 className="font-medium mb-2">Filter by approval</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="approved" 
                        checked={assetFilter.approved}
                        onCheckedChange={(checked) => 
                          setAssetFilter(prev => ({...prev, approved: checked === true}))
                        }
                      />
                      <Label htmlFor="approved">Approved</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="not-approved" 
                        checked={assetFilter.notApproved}
                        onCheckedChange={(checked) => 
                          setAssetFilter(prev => ({...prev, notApproved: checked === true}))
                        }
                      />
                      <Label htmlFor="not-approved">Not Approved</Label>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {filteredRelatedVideos.length > 0 ? (
              <Table>
                <TableCaption>List of related videos with the same asset ID.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRelatedVideos.map(relatedVideo => (
                    <TableRow key={relatedVideo.id}>
                      <TableCell>{relatedVideo.metadata?.title || 'Untitled'}</TableCell>
                      <TableCell>{relatedVideo.metadata?.creatorName || relatedVideo.reviewer_name}</TableCell>
                      <TableCell>{formatDate(relatedVideo.created_at)}</TableCell>
                      <TableCell>
                        {relatedVideo.admin_approved === true ? (
                          <Badge variant="success" className="gap-1">
                            <Check className="h-3 w-3" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <X className="h-3 w-3" />
                            Not Approved
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/assets/loras/${relatedVideo.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState 
                title="No related assets found"
                description="There are no other assets associated with this video, or none match your current filter."
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default VideoPage;
