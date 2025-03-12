
import React, { useState, useRef, useEffect } from 'react';
import { videoDB } from '@/lib/db';
import { VideoEntry } from '@/lib/types';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Eye, Trash, VideoIcon, Check, X, Play, PauseIcon, RefreshCw } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const Admin: React.FC = () => {
  const [entries, setEntries] = useState<VideoEntry[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isPlayingTogether, setIsPlayingTogether] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const responseVideoRef = useRef<HTMLVideoElement>(null);
  
  // Load entries when component mounts
  useEffect(() => {
    loadEntries();
    
    // Cleanup on unmount
    return () => {
      stopAllPlayback();
    };
  }, []);

  const loadEntries = () => {
    setIsLoading(true);
    try {
      const loadedEntries = videoDB.getAllEntries();
      setEntries(loadedEntries);
      console.log('Loaded entries:', loadedEntries.length);
      
      if (loadedEntries.length === 0) {
        toast.info('No video entries found');
      }
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Failed to load video entries');
    } finally {
      setIsLoading(false);
    }
  };

  const stopAllPlayback = () => {
    if (originalVideoRef.current) {
      originalVideoRef.current.pause();
    }
    if (responseVideoRef.current) {
      responseVideoRef.current.pause();
    }
    setIsPlayingTogether(false);
  };

  const handleRefresh = () => {
    stopAllPlayback();
    setSelectedVideo(null);
    setSelectedResponse(null);
    setSelectedEntryId(null);
    loadEntries();
    toast.success('Data refreshed');
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all entries? This cannot be undone.')) {
      videoDB.clearAllEntries();
      setEntries([]);
      setSelectedVideo(null);
      setSelectedResponse(null);
      setSelectedEntryId(null);
      setIsPlayingTogether(false);
      toast.success('All entries cleared');
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this entry? This cannot be undone.')) {
      try {
        // Get updated entries directly from localStorage to ensure consistency
        const currentEntries = videoDB.getAllEntries();
        const updatedEntries = currentEntries.filter(entry => entry.id !== id);
        localStorage.setItem('video_response_entries', JSON.stringify(updatedEntries));
        setEntries(updatedEntries);
        
        // Clear selection if the deleted entry was selected
        if (id === selectedEntryId) {
          stopAllPlayback();
          setSelectedVideo(null);
          setSelectedResponse(null);
          setSelectedEntryId(null);
        }
        
        toast.success('Entry deleted');
      } catch (error) {
        console.error('Error deleting entry:', error);
        toast.error('Failed to delete entry');
      }
    }
  };

  const playVideosTogether = () => {
    if (!originalVideoRef.current || !responseVideoRef.current) {
      toast.error('Videos not available');
      return;
    }

    if (isPlayingTogether) {
      // If already playing, pause both videos
      originalVideoRef.current.pause();
      responseVideoRef.current.pause();
      setIsPlayingTogether(false);
      toast.info('Videos paused');
      console.log('Both videos paused');
      return;
    }

    // Reset both videos to the beginning
    originalVideoRef.current.currentTime = 0;
    responseVideoRef.current.currentTime = 0;
    
    // Ensure videos are unmuted when playing together
    originalVideoRef.current.muted = false;
    responseVideoRef.current.muted = true; // Mute response video when playing together
    
    // Start playing both videos
    Promise.all([
      originalVideoRef.current.play().catch(error => {
        console.error('Error playing original video:', error);
        toast.error('Could not play original video');
        throw error;
      }),
      responseVideoRef.current.play().catch(error => {
        console.error('Error playing response video:', error);
        toast.error('Could not play response video');
        throw error;
      })
    ]).then(() => {
      setIsPlayingTogether(true);
      toast.success('Playing videos together');
      console.log('Both videos started playing successfully');
    }).catch((error) => {
      console.error('Failed to play videos together:', error);
      setIsPlayingTogether(false);
    });
  };

  // Select an entry
  const handleSelectEntry = (entry: VideoEntry) => {
    console.log('Selecting entry:', entry.id);
    
    // Reset playback state
    stopAllPlayback();
    
    // Update selected entry ID immediately
    setSelectedEntryId(entry.id);
    
    // Force clean slate when selecting a new entry
    setSelectedVideo(null);
    setSelectedResponse(null);
    
    // Small delay to ensure state is cleared before setting new values
    setTimeout(() => {
      console.log(`Setting video: ${entry.video_location}`);
      setSelectedVideo(entry.video_location);
      
      if (entry.acting_video_location) {
        console.log(`Setting response: ${entry.acting_video_location}`);
        setSelectedResponse(entry.acting_video_location);
      }
    }, 100);
  };

  const renderVideoPlayer = (src: string | null, ref: React.RefObject<HTMLVideoElement>, label: string) => {
    if (!src) return null;
    
    return (
      <div className="bg-card rounded-lg shadow-sm p-4 border">
        <h3 className="text-md font-medium mb-3">{label}</h3>
        <div className="aspect-video w-full bg-black rounded-md overflow-hidden">
          <VideoPlayer 
            src={src}
            controls 
            autoPlay={false} 
            muted={isPlayingTogether && label === "Video Response"}
            videoRef={ref}
            key={`${label}-${selectedEntryId}-${Date.now()}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background animate-fade-in">
      <Navigation />
      
      <main className="flex-1 container max-w-6xl py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </Button>
            <Button onClick={handleClearAll} variant="destructive" className="gap-2">
              <Trash className="h-4 w-4" />
              Clear All
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading video entries...</p>
          </div>
        ) : entries.length === 0 ? (
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
                        selectedEntryId === entry.id 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelectEntry(entry)}
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
              {selectedEntryId ? (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Video Preview</h3>
                    {selectedVideo && selectedResponse && (
                      <Button 
                        variant="default" 
                        className="gap-2"
                        onClick={playVideosTogether}
                      >
                        {isPlayingTogether ? (
                          <>
                            <PauseIcon className="h-4 w-4" />
                            Pause Videos
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Play Together
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedVideo ? (
                      renderVideoPlayer(selectedVideo, originalVideoRef, "Original Video")
                    ) : (
                      <div className="bg-muted/30 rounded-lg p-6 text-center flex flex-col items-center justify-center">
                        <p className="text-muted-foreground">Loading original video...</p>
                      </div>
                    )}
                    
                    {selectedResponse ? (
                      renderVideoPlayer(selectedResponse, responseVideoRef, "Video Response")
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
