
import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { videoDB } from '@/lib/db';
import { VideoEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import StorageVideoPlayer from '@/components/StorageVideoPlayer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StorageSettings from '@/components/StorageSettings';

const Admin: React.FC = () => {
  const [entries, setEntries] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = () => {
    setIsLoading(true);
    const allEntries = videoDB.getAllEntries();
    // Sort by date (newest first)
    allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setEntries(allEntries);
    setIsLoading(false);
  };

  const handleApproveToggle = async (entry: VideoEntry) => {
    try {
      const updatedEntry = videoDB.setApprovalStatus(entry.id, !entry.admin_approved);
      if (updatedEntry) {
        setEntries(entries.map(e => e.id === entry.id ? updatedEntry : e));
        toast.success(`Video ${updatedEntry.admin_approved ? 'approved' : 'unapproved'} successfully`);
      }
    } catch (error) {
      console.error('Error toggling approval:', error);
      toast.error('Failed to update approval status');
    }
  };

  const handleDeleteEntry = async (entry: VideoEntry) => {
    if (!window.confirm(`Are you sure you want to delete this video by ${entry.reviewer_name}?`)) {
      return;
    }

    try {
      const success = await videoDB.deleteEntry(entry.id);
      if (success) {
        setEntries(entries.filter(e => e.id !== entry.id));
        toast.success('Video deleted successfully');
      } else {
        toast.error('Failed to delete video');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Error deleting video');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL videos? This cannot be undone.')) {
      return;
    }

    try {
      await videoDB.clearAllEntries();
      setEntries([]);
      toast.success('All videos deleted successfully');
    } catch (error) {
      console.error('Error clearing entries:', error);
      toast.error('Failed to delete all videos');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="container py-8 px-4 flex-1">
        <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground mb-8">Manage video submissions and settings</p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="videos">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">All Videos</h2>
              {entries.length > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={handleClearAll}
                  size="sm"
                >
                  Delete All
                </Button>
              )}
            </div>

            {isLoading ? (
              <p>Loading videos...</p>
            ) : entries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No videos have been uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-8">
                {entries.map(entry => (
                  <div key={entry.id} className="border rounded-lg overflow-hidden bg-card">
                    <div className="p-4 border-b flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{entry.reviewer_name}</h3>
                        <p className="text-sm text-muted-foreground">Uploaded: {formatDate(entry.created_at)}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant={entry.admin_approved ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleApproveToggle(entry)}
                        >
                          {entry.admin_approved ? "Unapprove" : "Approve"}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteEntry(entry)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Original Video</p>
                        <div className="rounded overflow-hidden bg-black aspect-video">
                          <StorageVideoPlayer
                            videoLocation={entry.video_location}
                            className="w-full h-full"
                            controls
                          />
                        </div>
                      </div>
                      
                      {entry.acting_video_location && (
                        <div>
                          <p className="text-sm font-medium mb-2">Response Video</p>
                          <div className="rounded overflow-hidden bg-black aspect-video">
                            <StorageVideoPlayer
                              videoLocation={entry.acting_video_location}
                              className="w-full h-full"
                              controls
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <h2 className="text-2xl font-semibold mb-6">Application Settings</h2>
            <StorageSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
