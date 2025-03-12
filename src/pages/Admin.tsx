
import React, { useState, useRef } from 'react';
import { videoDB } from '@/lib/db';
import { VideoEntry } from '@/lib/types';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Eye, Trash, VideoIcon, Check, X, Play } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const Admin: React.FC = () => {
  const [entries, setEntries] = useState<VideoEntry[]>(() => videoDB.getAllEntries());
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [isPlayingTogether, setIsPlayingTogether] = useState(false);
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const responseVideoRef = useRef<HTMLVideoElement>(null);

  const handleRefresh = () => {
    setEntries(videoDB.getAllEntries());
    toast.success('Data refreshed');
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all entries? This cannot be undone.')) {
      videoDB.clearAllEntries();
      setEntries([]);
      setSelectedVideo(null);
      setSelectedResponse(null);
      toast.success('All entries cleared');
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this entry? This cannot be undone.')) {
      const updatedEntries = entries.filter(entry => entry.id !== id);
      localStorage.setItem('video_response_entries', JSON.stringify(updatedEntries));
      setEntries(updatedEntries);
      
      // Clear selection if the deleted entry was selected
      const deletedEntry = entries.find(entry => entry.id === id);
      if (deletedEntry) {
        if (deletedEntry.video_location === selectedVideo) {
          setSelectedVideo(null);
          setSelectedResponse(null);
          setIsPlayingTogether(false);
        }
      }
      
      toast.success('Entry deleted');
    }
  };

  const playVideosTogether = () => {
    if (!originalVideoRef.current || !responseVideoRef.current) {
      toast.error('Videos not available');
      return;
    }

    // Reset both videos to the beginning
    originalVideoRef.current.currentTime = 0;
    responseVideoRef.current.currentTime = 0;
    
    // Start playing both videos
    const playPromise1 = originalVideoRef.current.play();
    const playPromise2 = responseVideoRef.current.play();
    
    Promise.all([
      playPromise1.catch(error => {
        console.error('Error playing original video:', error);
        toast.error('Could not play original video');
      }),
      playPromise2.catch(error => {
        console.error('Error playing response video:', error);
        toast.error('Could not play response video');
      })
    ]).then(() => {
      setIsPlayingTogether(true);
      toast.success('Playing videos together');
    }).catch(() => {
      setIsPlayingTogether(false);
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background animate-fade-in">
      <Navigation />
      
      <main className="flex-1 container max-w-6xl py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="outline" className="gap-2">
              Refresh Data
            </Button>
            <Button onClick={handleClearAll} variant="destructive" className="gap-2">
              <Trash className="h-4 w-4" />
              Clear All
            </Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <VideoIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h2 className="text-xl font-medium mb-2">No entries found</h2>
            <p className="text-muted-foreground">
              Video entries will appear here once they've been uploaded or recorded.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="p-4 bg-card rounded-lg shadow-sm border">
                <h2 className="text-lg font-semibold mb-3">Video Entries ({entries.length})</h2>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                  {entries.map((entry) => (
                    <div 
                      key={entry.id}
                      className={`p-3 rounded-md border transition-colors cursor-pointer ${
                        selectedVideo === entry.video_location 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setSelectedVideo(entry.video_location);
                        setSelectedResponse(entry.acting_video_location);
                        setIsPlayingTogether(false);
                      }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium truncate">
                          {entry.reviewer_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <VideoIcon className="h-3.5 w-3.5 text-primary" />
                          <span>Original</span>
                        </div>
                        {entry.acting_video_location ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="h-3.5 w-3.5" />
                            <span>Has response</span>
                          </div>
                        ) : entry.skipped ? (
                          <div className="flex items-center gap-1 text-amber-600">
                            <X className="h-3.5 w-3.5" />
                            <span>Skipped</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <span>Pending response</span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end mt-2">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry.id);
                          }}
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2 space-y-4">
              {selectedVideo ? (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Video Preview</h3>
                    {selectedResponse && (
                      <Button 
                        variant="default" 
                        className="gap-2"
                        onClick={playVideosTogether}
                        disabled={isPlayingTogether}
                      >
                        <Play className="h-4 w-4" />
                        Play Together
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-card rounded-lg shadow-sm p-4 border">
                      <h3 className="text-md font-medium mb-3">Original Video</h3>
                      <div className="aspect-video w-full bg-black rounded-md overflow-hidden">
                        <VideoPlayer 
                          src={selectedVideo} 
                          controls 
                          autoPlay={false} 
                          muted={false}
                          videoRef={originalVideoRef}
                        />
                      </div>
                    </div>
                    
                    {selectedResponse ? (
                      <div className="bg-card rounded-lg shadow-sm p-4 border">
                        <h3 className="text-md font-medium mb-3">Video Response</h3>
                        <div className="aspect-video w-full bg-black rounded-md overflow-hidden">
                          <VideoPlayer 
                            src={selectedResponse} 
                            controls 
                            autoPlay={false} 
                            muted={false} 
                            videoRef={responseVideoRef}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/30 rounded-lg p-6 text-center flex flex-col items-center justify-center">
                        <p className="text-muted-foreground">No response video available</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-muted/30 rounded-lg p-12 text-center h-full flex flex-col items-center justify-center">
                  <Eye className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-lg text-muted-foreground">Select a video entry to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
