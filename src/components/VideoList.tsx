
import React from 'react';
import { VideoEntry } from '@/lib/types';
import VideoPlayer from '@/components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { MessageSquareText, VideoIcon } from 'lucide-react';

interface VideoListProps {
  videos: VideoEntry[];
  onSelectVideo: (video: VideoEntry) => void;
}

const VideoList: React.FC<VideoListProps> = ({ videos, onSelectVideo }) => {
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
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                  <VideoIcon className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium">{video.reviewer_name}</span>
              </div>
            </CardContent>
            <CardFooter className="pt-0 pb-4">
              <Button 
                onClick={() => onSelectVideo(video)} 
                className="w-full gap-2"
              >
                <MessageSquareText className="h-4 w-4" />
                Respond
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VideoList;
