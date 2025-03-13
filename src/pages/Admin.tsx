import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { videoDB } from '@/lib/db';
import { VideoEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import StorageVideoPlayer from '@/components/StorageVideoPlayer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StorageSettings from '@/components/StorageSettings';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import RequireAuth from '@/components/RequireAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const Admin: React.FC = () => {
  const [entries, setEntries] = useState<VideoEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<VideoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');
  
  // Filter state
  const [showApproved, setShowApproved] = useState(true);
  const [showUnapproved, setShowUnapproved] = useState(true);
  const [showResponded, setShowResponded] = useState(true);
  const [showSkipped, setShowSkipped] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  // Apply filters whenever entries or filter states change
  useEffect(() => {
    applyFilters();
  }, [entries, showApproved, showUnapproved, showResponded, showSkipped]);

  const applyFilters = () => {
    // Start with all entries
    let result = [...entries];
    
    // Apply approval filter
    if (!showApproved && !showUnapproved) {
      // If neither is checked, show nothing
      result = [];
    } else if (showApproved && !showUnapproved) {
      // Only show approved
      result = result.filter(entry => entry.admin_approved);
    } else if (!showApproved && showUnapproved) {
      // Only show unapproved
      result = result.filter(entry => !entry.admin_approved);
    }
    // If both are checked, no filtering by approval status
    
    // Then apply response status filters
    if (result.length > 0) {
      // Create empty filtered array
      const responseFiltered: VideoEntry[] = [];
      
      // Check each filter criterion separately
      if (showResponded) {
        // Add videos with responses
        const responded = result.filter(entry => entry.acting_video_location);
        responseFiltered.push(...responded);
      }
      
      if (showSkipped) {
        // Add skipped videos
        const skipped = result.filter(entry => entry.skipped);
        responseFiltered.push(...skipped);
      }
      
      if (!showResponded && !showSkipped) {
        // If neither responded nor skipped is checked, show nothing
        result = [];
      } else if (!showResponded) {
        // If "Responded" is not checked, also include videos waiting for response
        const waiting = result.filter(entry => !entry.acting_video_location && !entry.skipped);
        responseFiltered.push(...waiting);
      }
      
      // If both are checked, keep the original result from the approval filter
      if (!showResponded || !showSkipped) {
        // Convert to Set and back to array to remove duplicates
        result = Array.from(new Set(responseFiltered));
      }
    }
    
    setFilteredEntries(result);
  };

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const db = await databaseSwitcher.getDatabase();
      let allEntries;
      
      allEntries = await db.getAllEntries();
      
      // Sort by date (newest first)
      allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEntries(allEntries);
      
      console.log('Loaded entries from database:', allEntries.length, 'entries');
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Failed to load videos');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveToggle = async (entry: VideoEntry) => {
    try {
      const db = await databaseSwitcher.getDatabase();
      const updatedEntry = await db.setApprovalStatus(entry.id, !entry.admin_approved);
      
      if (updatedEntry) {
        setEntries(entries.map(e => e.id === entry.id ? updatedEntry : e));
        toast.success(`Video ${updatedEntry.admin_approved ? 'approved' : 'unapproved'} successfully`);
      }
    } catch (error: any) {
      console.error('Error toggling approval:', error);
      toast.error(error.message || 'Failed to update approval status');
    }
  };

  const handleDeleteEntry = async (entry: VideoEntry) => {
    if (!window.confirm(`Are you sure you want to delete this video by ${entry.reviewer_name}?`)) {
      return;
    }

    try {
      const db = await databaseSwitcher.getDatabase();
      const success = await db.deleteEntry(entry.id);
      
      if (success) {
        setEntries(entries.filter(e => e.id !== entry.id));
        toast.success('Video deleted successfully');
      } else {
        toast.error('Failed to delete video');
      }
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error(error.message || 'Error deleting video');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL videos? This cannot be undone.')) {
      return;
    }

    try {
      const db = await databaseSwitcher.getDatabase();
      await db.clearAllEntries();
      setEntries([]);
      toast.success('All videos deleted successfully');
    } catch (error: any) {
      console.error('Error clearing entries:', error);
      toast.error(error.message || 'Failed to delete all videos');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <RequireAuth requireAdmin>
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
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={loadEntries}
                    size="sm"
                  >
                    Refresh
                  </Button>
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
              </div>
              
              {/* Filter toggles */}
              <div className="flex flex-wrap gap-6 mb-6 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-approved" 
                    checked={showApproved} 
                    onCheckedChange={(checked) => setShowApproved(checked as boolean)} 
                  />
                  <Label htmlFor="filter-approved">Approved</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-unapproved" 
                    checked={showUnapproved} 
                    onCheckedChange={(checked) => setShowUnapproved(checked as boolean)} 
                  />
                  <Label htmlFor="filter-unapproved">Unapproved</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-responded" 
                    checked={showResponded} 
                    onCheckedChange={(checked) => setShowResponded(checked as boolean)} 
                  />
                  <Label htmlFor="filter-responded">Responded</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-skipped" 
                    checked={showSkipped} 
                    onCheckedChange={(checked) => setShowSkipped(checked as boolean)} 
                  />
                  <Label htmlFor="filter-skipped">Skipped</Label>
                </div>
              </div>

              {isLoading ? (
                <p>Loading videos...</p>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">No videos match your current filters</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {filteredEntries.map(entry => (
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
              <StorageSettings onSettingsSaved={loadEntries} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </RequireAuth>
  );
};

export default Admin;
