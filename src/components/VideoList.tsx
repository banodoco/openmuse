
import React from 'react';
import { VideoEntry } from '@/lib/types';
import VideoPlayer from '@/components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { MessageSquareText, VideoIcon, ExternalLink, Paintbrush, Layers, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface VideoListProps {
  videos: VideoEntry[];
  onSelectVideo: (video: VideoEntry) => void;
}

const VideoList: React.FC<VideoListProps> = ({ videos, onSelectVideo }) => {
  // Function to get the appropriate icon based on category
  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'art':
        return <Paintbrush className="h-3 w-3" />;
      case 'loras':
        return <Layers className="h-3 w-3" />;
      case 'generations':
      default:
        return <Sparkles className="h-3 w-3" />;
    }
  };

  // Function to get the category display name
  const getCategoryDisplayName = (category?: string) => {
    switch (category) {
      case 'art':
        return 'Art';
      case 'loras':
        return 'LoRAs';
      case 'generations':
      default:
        return 'Generations';
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Available Videos</h2>
        <Button variant="outline" className="gap-2">
          <VideoIcon className="h-4 w-4" />
          {videos.length} Videos
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="aspect-video overflow-hidden bg-black">
              <VideoPlayer
                src={video.video_location}
                controls
                muted
                className="w-full h-full"
              />
            </div>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                    <VideoIcon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">{video.reviewer_name}</span>
                </div>
                {video.category && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getCategoryIcon(video.category)}
                    {getCategoryDisplayName(video.category)}
                  </Badge>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-0 pb-4 flex gap-2">
              <Button 
                onClick={() => onSelectVideo(video)} 
                className="flex-1 gap-2"
              >
                <MessageSquareText className="h-4 w-4" />
                Respond
              </Button>
              <Button 
                variant="outline"
                asChild
                className="gap-2"
              >
                <Link to={`/assets/loras/${video.id}`}>
                  <ExternalLink className="h-4 w-4" />
                  View
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VideoList;
